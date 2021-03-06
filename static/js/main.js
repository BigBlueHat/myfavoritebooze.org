// monkey patch in .id.get() for older versions of browserid
if (navigator.id && navigator.id.getVerifiedEmail && !navigator.id.get) {
  navigator.id.get = navigator.id.getVerifiedEmail;
}

function setSessions(val) {
  if (navigator.id) {
    navigator.id.sessions = val ? val : [ ];
  }
}

// when the user is found to be logged in we'll update the UI, fetch and
// display the user's favorite booze from the server, and set up handlers to
// wait for user input (specifying their favorite booze).
function loggedIn(email, immediate) {
  setSessions([ { email: email } ]);

  // set the user visible display
  var l = $("header .login").removeClass('clickable');;
  l.empty();
  l.css('opacity', '1');
  l.append($("<span>").text("Yo, "))
    .append($("<span>").text(email).addClass("username"))
    .append($("<span>!</span>"));
  l.append($('<div><a id="logout" href="#" >(logout)</a></div>'));
  l.unbind('click');

  $("#logout").bind('click', logout);

  if (immediate) {
    $("#content .intro").hide();
    $("#content .business").fadeIn(300);
  }
  else {
    $("#content .intro").fadeOut(700, function() {
      $("#content .business").fadeIn(300);
    });
  }

  // enter causes us to save the value and do a little animation
  $('input').keypress(function(e){
    if(e.which == 13) {
      save(e);
    }
  });

  $("#save").click(save);

  $.ajax({
    type: 'GET',
    url: '/api/get',
    success: function(res, status, xhr) {
      $("input").val(res);
    }
  });

  // get a gravatar cause it's pretty
  var iurl = 'http://www.gravatar.com/avatar/' +
    Crypto.MD5($.trim(email).toLowerCase()) +
    "?s=32";
  $("<img>").attr('src', iurl).appendTo($("header .picture"));
}

function save(event) {
  event.preventDefault();
  $.ajax({
    type: 'POST',
    url: '/api/set',
    data: { booze: $("input").val() },
    success: function(res, status, xhr) {
      // noop
    }
  });
  $("#content input").fadeOut(200).fadeIn(400);
}

// when the user clicks logout, we'll make a call to the server to clear
// our current session.
function logout(event) {
  event.preventDefault();
  $.ajax({
    type: 'POST',
    url: '/api/logout',
    success: function() {
      // and then redraw the UI.
      // first tell browserid we're logged out
      if (navigator.id.logout) {
        navigator.id.logout(loggedOut);
      } else {
        loggedOut();
      }
    }
  });
}

// when no user is logged in, we'll display a "sign-in" button
// which will call into browserid when clicked.
function loggedOut() {
  setSessions();
  $("input").val("");
  $("#content .business").hide();
  $('.intro').fadeIn(300);
  $("header .picture").empty();
  var l = $("header .login").removeClass('clickable');
  l.html('<img src="i/sign_in_blue.png" alt="Sign in">')
    .show().click(function() {
      $("header .login").css('opacity', '0.5');
      navigator.id.get(gotVerifiedEmail, {allowPersistent: true});
    }).addClass("clickable").css('opacity','1.0');
}

// a handler that is passed an assertion after the user logs in via the
// browserid dialog
function gotVerifiedEmail(assertion) {
  // got an assertion, now send it up to the server for verification
  if (assertion !== null) {
    $.ajax({
      type: 'POST',
      url: '/api/login',
      data: { assertion: assertion },
      success: function(res, status, xhr) {
        if (res === null) loggedOut();
        else loggedIn(res);
      },
      error: function(xhr, status, error) {
        alert("login failure " + error);
      }
    });
  }
  else {
    loggedOut();
  }
}

// For some reason, login/logout do not respond when bound using jQuery
if (document.addEventListener) {
  document.addEventListener("login", function(event) {
    $("header .login").css('opacity', '0.5');
    navigator.id.get(gotVerifiedEmail, {allowPersistent: true});
  }, false);

  document.addEventListener("logout", logout, false);
}

$('#installApp button').click(function() {
  navigator.mozApps.install("/myfavoritebeer.webapp", "receipt goes here",
    function success() {
      console.log('Install success');
    }, function error() {
      console.log('Install error');
    });
});

// at startup let's check to see whether we're authenticated to
// myfavoritebooze (have existing cookie), and update the UI accordingly
$(function() {
  $.get('/api/whoami', function (res) {
    if (res === null) {
      // see if we are logged in by default
      if (navigator.id.get) {
        navigator.id.get(gotVerifiedEmail, {silent: true});
      } else {
        loggedOut();
      }
    } else {
      loggedIn(res, true);
    }
  }, 'json');
});
