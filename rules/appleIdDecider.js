function (user, context, callback) {
    const useragent = require('useragent');
    context.shouldLink = false;
    
    let agent = useragent.parse(context.request.userAgent);
    
    if (context.connection === 'apple') {
      if (context.stats.loginsCount <= 1) {
        context.shouldLink = true;
      }
    } else {
      if (agent.os.family === 'Mac OS X' || agent.os.family === 'iOS') {
        context.shouldLink = true;
      }
    }
    
    console.log("User is linkable?", context.shouldLink);
    callback(null, user, context);
  }