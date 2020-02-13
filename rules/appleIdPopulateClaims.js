function appleIdPopulateClaims(user, context, callback) {
  if (context.clientID === configuration.APPLE_LINK_CLIENT_ID) {
    context.idToken[configuration.NAMESPACE + "provider"] = context.connection;
    context.idToken[configuration.NAMESPACE + "loginsCount"] = context.stats.loginsCount;
  }

  return callback(null, user, context);
}