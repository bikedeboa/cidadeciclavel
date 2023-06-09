var BDB = BDB || {};

BDB.Map = (function () {
  //google maps api Key
  const apiKey = '<GOOGLE_MAPS_ID>';

  let map;
  let mapBounds;
  let geolocationMarker;
  let geolocationRadius;
  let bikeLayer;
  let mapZoomLevel; 
  let isGeolocated = false;
  let markerClickCallback;
  let markerClusterer;
  let areMarkersHidden = false;
  let directionsRenderer;
  let directionsService;
  let placesService;
  let infoWindow;
  let gmarkers;
  let searchMarker;


  const BoundingBoxArray = [
    //continente
    {
      sw: { lat: '36.838268541', lng: '-9.52657060387' },
      ne: { lat: '42.280468655', lng: '-6.3890876937' } 
    },
    // ilha da madeira 
    {
      sw: { lat: '32.629561', lng: '-17.279356' },
      ne: { lat: '32.874672', lng: '-16.652851' } 
    },
    //Açores 
    {
      sw: { lat: '36.899974', lng: '-31.359358' },
      ne: { lat: '39.764775', lng: '-24.937849' } 
    }
  ];
  const mapBoundsCoords = BoundingBoxArray;


  // function that must be called on map.init(), returns a promise.
  let loadScripts = function(){
    /*By default, $.getScript() sets the cache setting to false.This appends a timestamped query parameter to the 
     request URL to ensure that the browser downloads the script each time it is requested.You can override this 
     feature by setting the cache property globally using $.ajaxSetup():*/
    
    $.ajaxSetup({
      cache: true
    });

    return new Promise((resolve, reject) => {
    // Dynamically inject Google Map's lib
    // todo: apply reject behaviour.
      $.getScript('https://maps.googleapis.com/maps/api/js?key=<GOOGLE_MAPS_ID>&libraries=places&language=pt-BR', () => {
        $.getScript('/lib/infobox.min.js', () => {
          $.getScript('/lib/markerclusterer.min.js', () => {
            resolve();
          });
        });
      });
    });
  };

  let setMapElement = function(options) {
    let {coords, zoom, isUserLocation, elId} = options;
    const mapElem = document.getElementById(elId);

    if (!elId || !mapElem) {
      console.warn('Map initialization stopped: no #map element found');
      return;
    }

    let gpos = convertToGmaps(coords);
    
    map = new google.maps.Map(mapElem, { 
      center: gpos,
      zoom,
      disableDefaultUI: true,
      scaleControl: false,
      clickableIcons: false,
      styles: _gmapsCustomStyle,
      mapTypeControl: false,
      zoomControl: !_isMobile,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER
      }
    });

    mapBounds = [];
    mapBoundsCoords.forEach(bounds =>{
      mapBounds.push(new google.maps.LatLngBounds(
        new google.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
        new google.maps.LatLng(bounds.ne.lat, bounds.ne.lng)
      ));
    });

    setUserMarker();
    setUserRadius();

    if (isUserLocation) {
      updateUserMarkerPosition(gpos);
    }
 
    setInfoBox();
    mapCenterChanged();
    
    map.addListener('center_changed', mapCenterChanged);
    
    google.maps.event.addListener(map, 'zoom_changed', mapZoomChanged);
    mapZoomChanged();

    if (_isMobile) {
      google.maps.event.addListener(map, 'click', () => {
        if (infoWindow && infoWindow.reset) {
          infoWindow.reset();
        }
      });
    } 

    placesService = new google.maps.places.PlacesService(map);

   
    setupAutocomplete();
    
    // Defer initializations not needed in startup
    window.addEventListener('load', function () {
      setupBikeLayer();
    });

    // Native Event Dispatcher 
    let event = new Event('map:ready');
    document.dispatchEvent(event);
  };

  let convertToGmaps = function (obj, convert = true) {
    if (convert) {
      let coords = {
        lat: obj.latitude,
        lng: obj.longitude,
        accuracy: obj.accuracy
      };
      return coords;
    } else {
      return obj;
    }
  };
  
  let mapZoomChanged = function () {
    const prevZoomLevel = mapZoomLevel;
    mapZoomLevel = map.getZoom() <= MAX_ZOOM_TO_SHOW_PINS ? 'mini' : 'full';

    if (!prevZoomLevel || prevZoomLevel !== mapZoomLevel) { 
      if (!_activeFilters) {
        setMarkersIcon(mapZoomLevel); 
      }
    }
  };
  
  let mapCenterChanged = function () {
    clearTimeout(_centerChangedTimeout);
    _centerChangedTimeout = setTimeout(() => {

      const isCenterWithinBounds = isPosWithinBounds(map.getCenter());

      let centerInfo = {
        isCenterWithinBounds: isCenterWithinBounds,
        isViewWithinBounds: (map.getBounds()) ? isIntersected() : isCenterWithinBounds
      };
      let event = new CustomEvent('map:outofbounds', { detail: centerInfo });
      document.dispatchEvent(event);

    }, 50);
  };
  let isIntersected = function(){
    let ret = false;
    mapBounds.forEach(bounds =>{
      if (map.getBounds().intersects(bounds)){
        ret = true;
      }
    });
    return ret;
  };
  let isPosWithinBounds = function (pos) {
    let ret = false;
    mapBounds.forEach(bounds =>{
      if (bounds.contains(pos)){
        ret = true;
      }
    });
    return ret;
  };
  let setInfoBox = function () {
    // remove jquery reference.
    // const infoboxWidth = _isMobile ? $(window).width() * 0.95 : 400;
    // const infoboxWidth = _isMobile ? $(window).width() * 0.95 : 300;
    const infoboxWidth = 320;
    const myOptions = {
      maxWidth: 0,
      pixelOffset: new google.maps.Size(-infoboxWidth / 2, 0),
      disableAutoPan: _isMobile ? false : true,
      zIndex: null,
      boxStyle: {
        width: `${infoboxWidth}px`,
      },
      // closeBoxMargin: '10px 2px 2px 2px',
      closeBoxURL: '',
      infoBoxClearance: new google.maps.Size(1, 1),
      pane: 'floatPane',
      enableEventPropagation: false,
    };
    infoWindow = new InfoBox(myOptions);
  };
  let updateUserMarkerPosition = function (gposition) {
    if (map) {
      geolocationMarker.setPosition(gposition);
      geolocationRadius.setCenter(gposition);
      geolocationRadius.setRadius(gposition.accuracy);
    }
  };
  let updateUserPosition = function (coords, center = true, convert = true) {
    let gpos = convertToGmaps(coords, convert); 
    
    updateUserMarkerPosition(gpos);
    
    if (geolocationRadius) {
      geolocationRadius.setVisible(true);
    }

    if (center && map) {
      map.panTo(gpos); 
      if (map.getZoom() < 17) {
        map.setZoom(17);
      }
    }
  };
  let setUserMarker = function () {
    geolocationMarker = new google.maps.Marker({
      optimized: false, // more smooth in new Beta Renderer
      map: map,
      clickable: false,
    });
    setUserMarkerIcon();
  };
  let setUserMarkerIcon = function(){
    let iconName = (isGeolocated) ? 'current' : 'last';
    if (geolocationMarker) {
      geolocationMarker.setIcon({
        url: `/img/${iconName}_position.svg`, // url
        scaledSize: new google.maps.Size(CURRENT_LOCATION_MARKER_W, CURRENT_LOCATION_MARKER_H), // scaled size
        origin: new google.maps.Point(0, 0), // origin
        anchor: new google.maps.Point(CURRENT_LOCATION_MARKER_W / 2, CURRENT_LOCATION_MARKER_H / 2), // anchor
      });
    } else {
      console.warn('Error in setUserMarkerIcon(): geolocationMarker wasnt initialized');
    }
  };
  let setUserRadius = function () {
    geolocationRadius = new google.maps.Circle({
      map: map,
      clickable: false,
      fillColor: '#705EC7',
      fillOpacity: '0.2',
      strokeColor: 'transparent',
      strokeOpacity: '0'
    });
  };
  let geolocate = function (options = {}) {
    BDB.Geolocation.getLocation();

    $(document).one('geolocation:done', result => {
      if (result.detail.success) {
        if (!isGeolocated){
          isGeolocated = true;
          setUserMarkerIcon();
        }
        
        if (options.isInitializingGeolocation) {
          result.detail.center = false;
          BDB.Map.fitToNearestPlace();
        }

        updateUserPosition(result.detail.response, result.detail.center);
      }else{
        isGeolocated = false;
        setUserMarkerIcon();
      }
    });
  };

  let setupDirections = function (panel) {
    directionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      panel,
      hideRouteList: false,
      draggable: false,
      preserveViewport: false,
      suppressMarkers: false,
      suppressBicyclingLayer: false,
      suppressInfoWindows: true,
      polylineOptions: {
        clickable: false,
        strokeColor: '#98344c', // purple
        panel,
        strokeOpacity: 0.5,
        fillOpacity: 1,
        strokeWeight: 10,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillOpacity: 1,
            scale: 1,
            fillColor: '#FFF',
            strokeWeight: 0

          },
          offset: 0,
          repeat: '30px'
        }]
      }
    });
    directionsService = new google.maps.DirectionsService;
  };

  let setupAutocomplete = function () {
    const inputElem = document.getElementById('locationQueryInput');
    const originElem = document.getElementById('geolocationQuery');
    
    // Limits the search to the our bounding box
    const options = {
      componentRestrictions : {
       country : 'pt'
      },
      strictBounds: true
    };
    
    let autocomplete = new google.maps.places.Autocomplete(inputElem, options);
    let ogautocomplete = new google.maps.places.Autocomplete(originElem, options);



    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) {
        console.error('Autocomplete\'s returned place contains no geometry');
        return;
      }

      mapCenteredTo(place.geometry,true);

      let event = new CustomEvent('autocomplete:done', { detail: place });
      document.dispatchEvent(event);

    });

    ogautocomplete.addListener('place_changed', () => {
      const place = ogautocomplete.getPlace();
      if (!place.geometry) {
        console.error('Autocomplete\'s returned place contains no geometry');
        return;
      }

      mapCenteredTo(place.geometry,true);

      let event = new CustomEvent('ogautocomplete:done', { detail: place });
      document.dispatchEvent(event);

    });

  };

  let mapCenteredTo = function(place,pin){
    map.panTo(place.location);
    if (pin){
      if (searchMarker){
        searchMarker.setMap(null);
      }
      searchMarker = new google.maps.Marker({
        position: place.location,
        map: map,
      });
    }    
    if (place.viewport) {
      map.fitBounds(place.viewport);
    } else {
      map.setZoom(17);  // Why 17? Because it looks good.
    }
  }

  let setupBikeLayer = function () {
    if (!bikeLayer) {
      
      // Google Maps Bike Layer (sucks)
      bikeLayer = new google.maps.BicyclingLayer();
       
      // Custom, locally loaded GeoJSONs
      map.data.loadGeoJson('/geojson/cyclelane.lisbon.geojson'); 

    }
      
  };
  let setMarkersIcon = function(scale) {
    if (places) {
      let place;
      for (let i = 0; i < places.length; i++) {
        place = places[i];
        if (place.gmarker) {
          place.gmarker.setIcon(scale === 'mini' ? place.iconMini : place.icon);
        } else {
          console.error('ERROR: trying to set marker in place that has no gmarker associated');
        }
      }
    }
  };
  let searchAdress = function(address) {
    return new Promise(function (resolve, reject) {
      geocoder.geocode({ 'address': address }, function (results, status) {
        if (status === 'OK') {
          resolve(results[0]);
        } else {
          reject();
        }
      });
    });
  };
  return {
    init: function (coords, zoom, elId, getLocation, _markerClickCallback) {
      let options = Object.assign({isUserLocation : false}, {coords, zoom, elId});

      loadScripts().then(()=>{
        // enabling search address and reverse geocoder
        geocoder = new google.maps.Geocoder();
        // chech localStorage to see if there is a saved location;
        if (getLocation){
          options.coords = BDB.Geolocation.getLastestLocation() || options.coords;
          options.zoom = 14;
          options.isUserLocation = !!BDB.Geolocation.getLastestLocation();
        }

        markerClickCallback = _markerClickCallback;

        setMapElement(options);

        // if a coord is passed to the map so do not check for automatic geolocation check.
        if (getLocation){
          BDB.Geolocation.checkPermission().then(permission => {
            if (permission.state === 'granted') {
              geolocate({isInitializingGeolocation: true});
            }
          });
        }
      });             
    },
    searchAndCenter: function(address) {
      return new Promise(function (resolve, reject) {
        searchAdress(address) 
          .then( result => {

            mapCenteredTo(result.geometry, false);

            resolve();
          })
          .catch(reject);
      });
    },
    getStaticImgMap: function (staticImgDimensions, pinColor, lat, lng, customStyle, zoom = false) {
      let zoomStr = (zoom) ? `zoom=${zoom}&` : '';
      let imgUrl = `https://maps.googleapis.com/maps/api/staticmap?${zoomStr}size=${staticImgDimensions}&markers=icon:https://cidadeciclavel.mubi.pt/img/pin_${pinColor}.png|${lat},${lng}&key=${apiKey}&${_gmapsCustomStyleStaticApi}`;

      return imgUrl;
    },
    getGeolocation: function (options = {}) {
      geolocate(options);
    },
    showBikeLayer: function () {
      setupBikeLayer();
      
      if (bikeLayer) {
        bikeLayer.setMap(map);
        map.data.setStyle({  
          visible: true,
          strokeColor: '#007C4A', // dark green
          strokeWeight: 4,
          strokeOpacity: 1, 
          clickable: false
        });
      }
    },
    hideBikeLayer: function () {
      if (bikeLayer) {
        map.setOptions({ styles: _gmapsCustomStyle });
        bikeLayer.setMap(null);
      }

      map.data.setStyle({
        visible:false,
        strokeColor: '#007C4A', // dark green
        strokeWeight: 2,
        strokeOpacity: 1, 
        clickable: false
      });
    },
    checkBounds: function () {
      if (map) {
        return isPosWithinBounds(map.getCenter());
      } else {
        return false;
      }
    },
    goToCoords: function (coords) {
      map.setCenter(convertToGmaps(coords));
      map.setZoom(12);
      BDB.Geolocation.clearWatch();
    },
    getMap: function(){
      return map;
    },
    reverseGeocode: function(lat, lng) {
      return new Promise(function (resolve, reject) {
        const latlng = {lat: parseFloat(lat), lng: parseFloat(lng)};

        return geocoder.geocode({'location': latlng}, function(results, status) {
          if (status === google.maps.GeocoderStatus.OK) {
            if (results[0]) {
              const r = results[0].address_components;
              let formattedAddress;
              let length = Object.keys(r).length;
              if ( length > 1){
                formattedAddress = `${r[1].short_name}, ${r[0].short_name}`;
                if (r[3]) {
                  formattedAddress += ` - ${r[3].short_name}`;
                }  
              }else{
                formattedAddress = results[0].formatted_address
              }
              
              let city, state, country;

              r.forEach(address => {
                address.types.forEach(type => {
                  if (type === 'locality' || type === 'administrative_area_level_2') {
                    if (city && city != address.long_name) {
                      console.warn('reverseGeocode: conflicting city names:', city, address.long_name);
                    }  
                    city = address.long_name;
                  } else if (type === 'administrative_area_level_1') {
                    if (state && state != address.long_name) {
                      console.warn('reverseGeocode: conflicting state names:', state, address.long_name);
                    }
                    state = address.long_name;
                  } else if (type === 'country') {
                    if (country && country != address.long_name) {
                      console.warn('reverseGeocode: conflicting country names:', country, address.long_name);
                    }
                    country = address.long_name;
                  }
                });
              });

              resolve({
                address: formattedAddress,
                city: city,
                state: state,
                country: country
              });
            } else {
              console.error('No results found');
              reject();
            }
          } else {
            console.error('Geocoder failed due to: ' + status);
            reject(status);
          }
        });
      });
    },
    getMarkers: function() {
      // return markerClusterer && markerClusterer.getMarkers();
      return BDB.Markers.getGMarkers();
    },
    clearMarkers: function () {
      // setMapOnAll(null);
      BDB.Markers.clearMarkers();
    },
    // Sets the map on all markers in the array.
    setMapOnAll: function setMapOnAll(map) {
      if (places) {
        for (var i = 0; i < places.length; i++) {
          if (places[i].gmarker){
            places[i].gmarker.setMap(map);
          }
        }
      }
    },
    hideMarkers: function hideMarkers() {
      // Removes the markers from the map, but keeps them in the array.
      if (places) {
        for (var i = 0; i < places.length; i++) {
          if (places[i].gmarker){
            places[i].gmarker.setOptions({ clickable: false, opacity: 0 });
          }
        }
      }
    },
    showMarkers: function showMarkers() {
      // Shows any markers currently in the array.
      if (places) {
        for (var i = 0; i < places.length; i++) {
          if (places[i].gmarker){
            places[i].gmarker.setOptions({ clickable: true, opacity: 1 });
          }
        }
      }
    },
    // Switches all marker icons to the full or the mini scale
    // scale := 'mini' | 'full'
    setMarkersIcon: function(scale) {
      setMarkersIcon(scale);
    },
    toggleMarkers: function() {
      if (areMarkersHidden) {
        // showMarkers();
        setMarkersIcon('full');
        areMarkersHidden = false;
      } else {
        // hideMarkers();
        setMarkersIcon('mini');
        areMarkersHidden = true;
      }
    },
    getListOfPlaces: function (orderBy, maxPlaces = 50) {
      if (!places) {
        console.warn('ERROR in getListOfPlaces: places is null');
        return;
      }

      let markersToShow;
      switch (orderBy) {
      case 'nearest': { 
        // if (!_userCurrentPosition) {
        //   showSpinner('Localizando...');

        //   geolocate(true).then(() => {
        //     // hideSpinner();

        //     openNearbyPlacesModal(orderBy);
        //   }).catch(() => {
        //     console.error('Cant open nearby places, geolocation failed.');

        //     // hideSpinner();

        //     switchToMap();
        //   });
        //   return;
        // }

        // @todo do this properly
        const positionToCompare = BDB.Geolocation.getCurrentPosition();

        // Use nearest places
        for (let i = 0; i < places.length; i++) {
          const m = places[i];

          m.distance = distanceInKmBetweenEarthCoordinates(
            positionToCompare.latitude,
            positionToCompare.longitude, 
            m.lat,
            m.lng);
        }
        markersToShow = places.sort((a, b) => { return a.distance - b.distance; });
        markersToShow = markersToShow.slice(0, maxPlaces);
        break;
      }
      case 'updatedAt':
        // Most recently updated places
        // @todo bring this info from getAll endpoint
        markersToShow = places.sort((a, b) => { return b.updatedAt - a.updatedAt; });
        markersToShow = markersToShow.slice(0, maxPlaces);
        break;
      case 'best':
        // Best rated places
        markersToShow = places.sort((a, b) => {
          return (b.average * 1000 + b.reviews * 1) - (a.average * 1000 + a.reviews * 1);
        });
        markersToShow = markersToShow.slice(0, maxPlaces);
        break;
      }

      return markersToShow;
    },
    fitToNearestPlace: function(forceLongDistance = false) {
      if (!places) {
        console.warn('ERROR in fitToNearestPlace: places is null');
        return;
      }

      const currentPos = BDB.Geolocation.getCurrentPosition();
      if (!currentPos) {
        console.error('fitToNearestPlace(): dont have current pos');
        return;
      } 

      var nearest = this.getListOfPlaces('nearest', 1)[0];
      var nearestPos = { lat: parseFloat(nearest.lat), lng: parseFloat(nearest.lng) };

      const distanceKm = distanceInKmBetweenEarthCoordinates(currentPos.latitude, currentPos.longitude, nearestPos.lat, nearestPos.lng);
      const distanceMeters = parseInt(distanceKm / 1000);

      // console.log(distanceKm); 
      console.log(`[Analytics] Misc / distance to nearest pin (m) = ${distanceMeters}`);
      ga('send', 'event', 'Misc', 'distance to nearest pin (m)', '', distanceMeters);

      if (!forceLongDistance && distanceKm > MAX_KM_TO_FIT_TO_VIEWPORT) {
        console.warn('fitToNearestPlace(): wont do it, too far away:', distanceKm);
        return;
      } else {
        let bounds = new google.maps.LatLngBounds();
        bounds.extend(convertToGmaps(currentPos));  
        bounds.extend(nearestPos);
        map.fitBounds(bounds);
        map.panToBounds(bounds);

        // Also already shows itinerary to this nearest place
        // this.showDirectionsToPlace(nearestPos);
      }
    },
    showDirectionsToNearestPlace: function() {
      const nearest = BDB.Map.getListOfPlaces('nearest', 1)[0];
      this.showDirectionsToPlace({ lat: parseFloat(nearest.lat), lng: parseFloat(nearest.lng) });
    },
    showDirectionsToPlace: function(og, dt, panel, forceLongDistance = false) {
      //console.log(origin,destiny);
      // const travelMode = 'WALKING';
      const travelMode = 'BICYCLING'; 

      // const currentPos = BDB.Geolocation.getCurrentPosition();
      // if (!currentPos) {
      //   return;
      // }
        setupDirections(panel);
        directionsService.route({ 
          origin:  {lat: og.pos.lat, lng: og.pos.lng},
          destination:  { lat: dt.pos.lat, lng: dt.pos.lng},
          travelMode: google.maps.TravelMode[travelMode]
        }, function (response, status) {
          if (status == 'OK') {
            if (searchMarker){
              searchMarker.setMap(null);
            }
            directionsRenderer.setDirections(response); 
            let event = new CustomEvent('directions:done', {detail: true});
            document.dispatchEvent(event);
          } else {
            //let cacheMarker = searchMarker;
            if (searchMarker){
              searchMarker.setMap(null);
            }
            console.error('Directions request failed due to ' + status);
            let event = new CustomEvent('directions:done', {detail: false});
            document.dispatchEvent(event);
            //searchMarker = cacheMarker;
            searchMarker.setMap(map);
          }
        });
      

    },
    removeDirections: function() {
      directionsRenderer.set('directions', null);
    },
    getNameSuggestions: function (position) {
      return new Promise((resolve, reject) => {
        placesService.nearbySearch({
          location: position,
          radius: 10, // radius in meters
          type: 'point_of_interest' // exclude results like street names
        }, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            // Sort results by distance 
            for (var i = 0; i < results.length; i++) {
              results[i].distance = google.maps.geometry.spherical.computeDistanceBetween(
                map.getCenter(),
                results[i].geometry.location
              );
            }
            results.sort((a, b) => a.distance - b.distance);
             
            resolve(results);
          } else {
            reject();
          }
        });
      });
    },
    updateMarkers: function (clustered = true) {
      markerClusterer = BDB.Markers.updateMarkers(map, mapZoomLevel, infoWindow, markerClickCallback, clustered);
    },
    searchResults: function (place,pin){
      this.clearSearchResult();
      mapCenteredTo(place,pin);
    },
    clearSearchResult: function(){
      if (searchMarker){
        searchMarker.setMap(null);
      }
    }
  };
})();