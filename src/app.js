/**
 * Import config if .env is present
 */
import "dotenv/config";

/**
 * Import express and base utilities
 */
import Express from "express";
import cookieSession from "cookie-session";
import bodyParser from "body-parser";
import useragent from "useragent";

/**
 * Import auth0 and passport helpers
 */
import { ManagementClient } from "auth0";
import passport from "passport";
import Auth0 from "passport-auth0";
import { ensureLoggedIn } from "connect-ensure-login";

/**
 * Import utilities
 */
import { ensureAuthState } from "./ensureAuthState";
import { ensureProvider } from "./ensureProvider";

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
});

const app = Express();
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Setup rendering engine
 */
app.set("view engine", "pug");
app.set("trust proxy");

/**
 * Configure sessions, we use sessions 
 * in order to parse the body
 */
app.use(
  cookieSession({
    name: "session",
    secret: process.env.COOKIE_SECRET,
    // cookie options
    maxAge: 24 * 60 * 60 * 1000,
    // enable these when we are no longer using localhost:
    httpOnly: IS_PROD,
    secure: IS_PROD
  })
);

/**
 * Inject bodyParser
 */
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

// Configure Passport to use Auth0
var auth0 = new Auth0(
  {
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.BASE_URL + "/callback"
  },
  function(accessToken, refreshToken, extraParams, profile, done) {
    // accessToken is the token to call Auth0 API (not needed in the most cases)
    // extraParams.id_token has the JSON Web Token
    // profile has all the information from the user
    return done(null, profile);
  }
);

passport.use(auth0);

app.use(passport.initialize());
app.use(passport.session());

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Auth0 profile is serialized
//   and deserialized.
//
// Taken from https://github.com/jaredhanson/passport-google/blob/master/examples/signon/app.js
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Expose utilities to handle redirect rules better
app.use((req, res, next) => {
  const { session } = req;
  const { auth0State } = session;

  res.redirectCallback = (queryParams = {}) => {
    queryParams.state = auth0State;
    const queryStr = Object.entries(queryParams)
      .map(x => x.join("="))
      .join("&");

    const urlStr = `https://${process.env.AUTH0_DOMAIN}/continue?${queryStr}`;
    req.session = null;
    res.redirect(urlStr);
  };

  next();
});

/**
 * Populate parsed user agent
 */
app.use((req, res, next) => {
  req.ua = useragent.parse(req.get("User-Agent"));
  next();
});

/**
 * Upgrade custom claims to profile attributes
 */
app.use((req, _, next) => {
  const { user } = req;
  if (user) {
    const namespace = process.env.TOKEN_FIELD_NAMESPACE;
    for (const key of Object.keys(user._json)) {
      if (key.startsWith(namespace)) {
        const denamespaced = key.replace(namespace, "");
        if (user[denamespaced]) {
          continue;
        }
        user[denamespaced] = user._json[key];
      }
    }
  }
  next();
});

/**
 * Complete authentication
 */
app.get("/callback", function(req, res, next) {
  passport.authenticate("auth0", function(err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect("/login");
    }
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      const returnTo = req.session.returnTo;
      delete req.session.returnTo;
      res.redirect(returnTo || "/");
    });
  })(req, res, next);
});

/**
 * Route for passport
 */
app.get(
  "/login",
  passport.authenticate("auth0", {
    scope: "openid profile email"
  })
);

/**
 * Ensure everything beyond this point has a session
 */
app.use(
  ensureLoggedIn({
    redirectTo: "/login"
  })
);

/**
 * First handler for /start, capture the auth0 state parameter
 */
app.get("/start", (req, _, next) => {
  const { query } = req;
  const { state } = query;

  if (!state) {
    return next(new Error("Unauthorized `state` is missing"));
  }

  if (req.session.auth0State) {
    return next(
      new Error("Only one instance of redirect should run at a time")
    );
  }

  req.session.auth0State = state;
  next();
});

/**
 * Ensure everything beyond this point has auth state
 */
app.use(ensureAuthState);

/**
 * Actual starting point of our stateful app
 */
app.get("/start", (req, res) => {
  const { user } = req;
  if (user.provider === "apple") {
    return res.redirect("/prompt/apple");
  } else {
    const os = req.ua.os.family;
    if (os === "Mac OS X" || os === "iOS") {
      return res.redirect("/prompt/google");
    }
  }

  return res.redirectCallback();
});

/**
 * Prompt user to connect their google account
 */
app.get("/prompt/apple", ensureProvider("apple"), (req, res) => {
  res.render("apple", {
    ...req.user
  });
});

/**
 * Prompt user to connect thier apple account
 */
app.get("/prompt/google", ensureProvider("google-oauth2"), (req, res) => {
  res.render("google", {
    ...req.user
  });
});

/**
 * Handler for when both accounts are connected, link them
 */
app.get("/connect/done", async (req, res) => {
  if (!req.session.identities && req.session.identities.length < 1) {
    return next(new Error("Callback cannot be called without first Id"));
  }

  if (!req.session.expectedProvider) {
    return next(new Error("Callback cannot be called without expected provider"));
  }

  if (req.user.provider !== req.session.expectedProvider) {
    return next(new Error("Callback cannot be called without expected provider"));
  }

  const userid = req.user.id;
  req.session.identities.push(userid);

  const [primaryUserId, secondaryUserId] = req.session.identities;
  const [secondaryConnectionId, ...rest] = secondaryUserId.split("|");
  const secondaryUserProviderId = rest.join("|");

  try {
    await management.linkUsers(primaryUserId, {
      user_id: secondaryUserProviderId,
      provider: secondaryConnectionId
    });

    res.render("final", {
      primaryUser: primaryUserId,
      secondaryUser: secondaryUserId
    });
  } catch (e) {
    next(e);
  }

});

/**
 * IN case user clicks skip
 */
app.get("/connect/skip", (req, res) => {
  /**
   * We can also store the user's decision here and never
   * prompt them again by patching the user metadata 
   * 
   * await manage.updateUserMetadata(req.user.id, {
   *    skippedConnecting: true
   * });
   * 
   * Then in the rule we can simply cehck the property and bail out
   */
  res.redirect("/continue");
});

/**
 * Handler for when user chooses to login again
 */
app.get("/connect/:provider", (req, res, next) => {
  if (req.session.identities && req.session.identities.length > 0) {
    return next(new Error("Invalid step, linking already in progress"));
  }

  const userid = req.user.id;
  const { provider } = req.params;

  req.session.identities = [userid];
  req.session.returnTo = "/connect/done"
  req.session.expectedProvider = provider;

  passport.authenticate("auth0", {
    connection: provider,
    prompt: 'login',
    scope: 'openid profile email'
  })(req, res, next);

});

/**
 * Redirect back to Auth0
 */
app.get("/continue", (_, res) => {
  res.redirectCallback();
});

/**
 * Clear the session and print an error
 */
app.use((err, req, res, next) => {
  req.session = null;
  res.render('error', {
    url: req.originalUrl,
    message: err.message || 'Internal Server Error'
  });
});

export { app };
