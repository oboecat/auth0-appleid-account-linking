function appleIdDecider(user, context, callback) {
    const useragent = require('useragent');
    context.shouldPrompt = false;
    
    let agent = useragent.parse(context.request.userAgent);

    if (context.connection === 'apple') {
      if (context.stats.loginsCount <= 1) {
        context.shouldPrompt = true;
      }
    } else {
      const version = parseInt(agent.major, 10);
      const family = agent.family;
      // So far only Safari supports this, focus on that
      if (family === 'Safari' && version >= 13) {
        if (user.identities.every(({ provider }) => provider !== 'apple')) {
          context.shouldPrompt = true;
        }
      }
    }
    
    callback(null, user, context);
  }