function (user, context, callback) {
    if (context.shouldLink && context.clientID !== configuration.APPLE_LINK_CLIENT_ID) {
      console.log("Should redirect");
      context.redirect = {
        url: configuration.APPLE_LINK_APP_URI
      };
    }
    
    if (context.clientID === configuration.APPLE_LINK_CLIENT_ID) {
      // add custom parameters
      context.idToken[configuration.NAMESPACE + 'provider'] = context.connection;
      context.idToken[configuration.NAMESPACE + 'loginsCount'] = context.stats.loginsCount;
    }
    return callback(null, user, context);
  }