var BDB = BDB || {};

BDB.Router = (function(){

return {
  init : function(){
    console.log('Init');
  },
  changeUrl : function(){

  },
  handle : function(isInitial = false) {
    const urlBreakdown = window.location.pathname.split('/');
    let match = urlBreakdown[1];

    // Routes that on initial loading should be redirected to the Home
    if (isInitial) {
      switch(urlBreakdown[1]) {
      case 'novo':
      case 'novopedido':
      case 'decisao':
      case 'editar':
      case 'nav':
      case 'filtros':
      case 'foto':
        window.location.pathname = '';
        break;
      }
    }

    switch (urlBreakdown[1]) {
    case 'b':
      if (urlBreakdown[2] && urlBreakdown[2] !== 'foto') {
        let id = urlBreakdown[2].split('-')[0];
        if (id) {
          id = parseInt(id);

          if (isInitial) {
            _isDeeplink = true;
            $('body').addClass('deeplink');

            showSpinner('Carregando...');

            // Center the map on pin's position
            if (map && _deeplinkMarker) {
              map.setZoom(18);
              map.setCenter({
                lat: parseFloat(_deeplinkMarker.lat),
                lng: parseFloat(_deeplinkMarker.lng)
              });
            }
          
            routerOpenDeeplinkMarker(id, () => {
              hideSpinner();

              // @todo refactor this
              let coords = {
                latitude : parseFloat(_deeplinkMarker.lat),
                longitude: parseFloat(_deeplinkMarker.lng)
              };
              start_coords = coords;  
              zoom = 17;
              getGeolocation = false;

              // Delay loading of background map for maximum optimized startup
              if (!_isMobile) {
                $(document).trigger('LoadMap');
              }
            });
          } else {
            routerOpenLocal(id);
          }
        } else {
          // 404 code. 
          openNotFoundModal(match);
          match = false;
        }
      }
      break;
    case 'r' : 
      if (urlBreakdown[2] && urlBreakdown[2] !== 'foto') {
        let id = urlBreakdown[2].split('-')[0];
        if (id) {
          id = parseInt(id);

          if (isInitial) {
            _isDeeplink = true;
            $('body').addClass('deeplink');

            showSpinner('Carregando...');

            // Center the map on pin's position
            if (map && _deeplinkMarker) {
              map.setZoom(18);
              map.setCenter({
                lat: parseFloat(_deeplinkMarker.lat),
                lng: parseFloat(_deeplinkMarker.lng)
              });
            }
            
            //todo
            routerOpenDeepLinkRequest(id, () => {
              hideSpinner();

              // @todo refactor this
              let coords = {
                latitude : parseFloat(_deeplinkMarker.lat),
                longitude: parseFloat(_deeplinkMarker.lng)
              };
              start_coords = coords;  
              zoom = 17;
              getGeolocation = false;

              // Delay loading of background map for maximum optimized startup
              if (!_isMobile) {
                $(document).trigger('LoadMap');
              }
            });
          } else {
            routerOpenRequest(id);
          }
        } else {
          // 404 code. 
          openNotFoundModal(match);
          match = false;
        }
      }
      break;
    case 'faq':
      openFaqModal();
      break;
    case 'como-instalar':
      if (isInitial) {
        _isDeeplink = true;
        $('body').addClass('deeplink');
      }
      openHowToInstallModal();
      break;
    case 'guia-de-bicicletarios':
      if (isInitial) {
        _isDeeplink = true;
        $('body').addClass('deeplink');
      }
      openGuideTypesModal(!!isInitial);   
      break;
    case 'guia-seguranca':
      openGuideTagsModal();
      break;
    case 'sobre':
      if (isInitial) {
        _isDeeplink = true;
        $('body').addClass('deeplink');
      }
      openAboutModal();
      break;
    case 'sobre-nossos-dados':
      openDataModal();
      break;
    case 'contribuicoes':
      hideAll();

      if (!BDB.User.isLoggedIn) {
        openLoginDialog(true);
 
        $(document).one('bikedeboa.login', () => {
          openContributionsModal();
        });
      } else {
        openContributionsModal();
      }

      break;
    case 'nav':
      _hamburgerMenu.show();
      break;
    case 'filtros':
      _filterMenu.show();
      break;
    case 'cidades-mapeadas':
      openTopCitiesModal(); 
      break;
    case 'novo':
    case 'novopedido':
    case 'editar':
    case 'foto':
    case 'dados':
    case 'decisao':
      break;
    case '':
      if (!map && !_isOffline) {
        $(document).trigger('LoadMap');
        //BDB.Map.updateMarkers();
      }
 
      if (_isDeeplink) {
        // $('#map').removeClass('mock-map');
        // $('#logo').removeClass('clickable');
        $('body').removeClass('deeplink');
        _isDeeplink = false;
      }

      hideAll();
      break;
    default:
      openNotFoundModal(match);
      match = false; 
      break;
    }

    return match;
  }
}
})(); 
