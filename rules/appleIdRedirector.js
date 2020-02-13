function appleIdRedirector(user, context, callback) {
  function canRedirect(context, selfClientId) {
    const protocolsThatDontWork = [
      "redirect-callback",
      "oauth2-password",
      "oauth2-refresh-token",
      "oauth2-resource-owner"
    ];
    if (protocolsThatDontWork.includes(context.protocol)) {
      return false;
    }

    const { response_mode: responseMode } = context.request.query || {};
    const responseModeThatDontWork = ["web_message"];

    if (responseModeThatDontWork.includes(responseMode)) {
      return false;
    }

    // Prevent Redirect Loop
    if (context.clientID === selfClientId) {
      return false;
    }
    return true;
  }

  if (!canRedirect(context, configuration.APPLE_LINK_CLIENT_ID)) {
    callback(null, user, context);
    return;
  }

  if (context.shouldPrompt) {
    console.log("Should redirect");
    context.redirect = {
      url: configuration.APPLE_LINK_APP_URI
    };
  }

  return callback(null, user, context);
}
