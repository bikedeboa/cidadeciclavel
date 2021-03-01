var BDB = BDB || {};

BDB.Session = {
  ///////////////////
  // G L O B A L S //
  ///////////////////


  ///////////////////
  // M E T H O D S //
  ///////////////////

  setPromoBannerViewed: function() {
    Cookies.set('bikedeboa_promobanner_questionario', 'true', { expires: 365 }); 
  },

  getPromoBannerViewed: function() {
    return Cookies.get('bikedeboa_promobanner_questionario');
  },

  setWelcomeMessageViewed: function() {
    Cookies.set('cidadeciclavel__has_seen_welcome_message', 'true', { expires: 365 }); 
  },

  setPlaceWarning: function(place) {
    Cookies.set('cidadeciclavel__has_seen_'+ place +'_message', 'true', { expires: 365 }); 
  },
  getPlaceWarning: function(place){
    const hasSeen = !!Cookies.get('cidadeciclavel__has_seen_'+ place +'_message');
    return hasSeen;
  },
  hasUserSeenWelcomeMessage: function() {
    const hasSeenWelcomeMessage = !!Cookies.get('cidadeciclavel__has_seen_welcome_message');

    return hasSeenWelcomeMessage;
  }
};
