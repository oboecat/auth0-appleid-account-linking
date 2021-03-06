import "dotenv/config";
import Express from "express";
import bodyParser from "body-parser";
import useragent from "useragent";
import { auth } from "express-openid-connect";
import { ManagementClient } from "auth0";
import { ensureAuthState } from "./ensureAuthState";
import { ensureProvider } from "./ensureProvider";
import CookieSession from "cookie-session";

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
});

const app = Express();

const IS_PROD = process.env.NODE_ENV === "production";

app.set("view engine", "pug");
app.set("trust proxy", true);
app.use((req, _, next) =>  {
    console.log(req.originalUrl);
    next();
});

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

app.use(
  CookieSession({
    name: "session",
    secret: process.env.COOKIE_SECRET,
    // cookie options
    maxAge: 24 * 60 * 60 * 1000,
    // enable these when we are no longer using localhost:
    httpOnly: IS_PROD,
    secure: IS_PROD
  })
);

app.use(auth());

// Redirect rule handler
app.use((req, res, next) => {
  const { session } = req;
  const { auth0State } = session;

  res.redirectCallback = (queryParams = {}) => {
    queryParams.state = auth0State;
    const queryStr = Object.entries(queryParams)
      .map(x => x.join("="))
      .join("&");

    const returnTo = `${process.env.ISSUER_BASE_URL}continue?${queryStr}`;
    req.session = null;
    res.openid.logout({ returnTo });
  };

  next();
});

app.use((req, _, next) => {
  req.ua = useragent.parse(req.get("User-Agent"));
  next();
});

/**
 * Upgrade custom claims to profile attributes
 */
app.use((req, _, next) => {
  if (req.openid && req.openid.user) {
    const { user } = req.openid;
    const namespace = process.env.TOKEN_FIELD_NAMESPACE;
    for (const key of Object.keys(user)) {
      if (key.startsWith(namespace)) {
        const denamespaced = key.replace(namespace, "");
        if (user[denamespaced]) {
          console.warn(
            "Tried to assign pre-existing attribute %s to user from custom attributes, ignoring",
            denamespaced
          );
          continue;
        }
        user[denamespaced] = user[key];
      }
    }
  }
  next();
});

/**
 * Only execute on /start, stateful-start
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

app.get("/start", (req, res) => {
  const { user } = req.openid;

  if (user.provider === "apple") {
    if (user.loginsCount <= 1) {
      return res.redirect("/prompt/apple");
    }
  } else {
    const browser = req.ua.family;
    const version = parseInt(req.ua.major, 10);

    if (browser === "Safari" && version >= 13) {
      return res.redirect("/prompt/google");
    }
  }

  return res.redirectCallback();
});

app.get("/prompt/apple", ensureProvider("apple"), (req, res) => {
  res.render("apple", {
    ...req.openid.user
  });
});

app.get("/prompt/google", ensureProvider("google-oauth2"), (req, res) => {
  res.render("google", {
    ...req.openid.user
  });
});

/**
 * Handler for second session
 */
app.get("/connect/done", ensureAuthState, async (req, res, next) => {
  if (!req.session.identities && req.session.identities.length < 1) {
    return next(new Error("Callback cannot be called without first Id"));
  }

  const userid = req.openid.user.sub;
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

app.get("/connect/skip", ensureAuthState, (req, res) => {
  /**
   * await manage.updateUserMetadata(req.openid.user.sub, {
   *    skippedConnecting: true
   * });
   */
  res.redirect("/continue");
});

app.get("/connect/:provider", ensureAuthState, (req, res, next) => {
  if (req.session.identities && req.session.identities.length > 0) {
    return next(new Error("Only one session can remain at a time"));
  }

  const userid = req.openid.user.sub;
  req.session.identities = [userid];

  const { provider } = req.params;
  res.openid.login({
    authorizationParams: {
      connection: provider
    },
    returnTo: "/connect/done"
  });
});

app.get("/continue", ensureAuthState, (_, res) => {
  res.redirectCallback();
});

/**
 * Clear the session and print an error
 */
app.use((err, req, res, next) => {
  req.session = null;
  res.render("error", {
    url: req.originalUrl,
    message: err.message || "Internal Server Error"
  });
});

export { app };
