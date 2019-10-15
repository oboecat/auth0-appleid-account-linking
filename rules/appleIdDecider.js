function (user, context, callback) {
    const useragent = require('useragent');
    // TODO: Rule to show cool Apple ID Flow
    // 1. If user logs in from AppleID and it's the first time, prompt to link accounts
    // 2. If they login from an apple device using other identity provider, prompt to link accounts
    // `context.shouldLink = true;`
  
    context.shouldLink = false;
    
    let agent = useragent.parse(context.request.userAgent);
    console.log(agent.os);
    
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