
  require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/smartMapping/renderers/color",
    "esri/smartMapping/statistics/histogram",
    "esri/widgets/smartMapping/ColorSlider",
    "esri/core/watchUtils"
  ], function (
    Map,
    MapView,
    FeatureLayer,
    colorRendererCreator,
    histogram,
    ColorSlider,
    watchUtils
  ) {
    // Create a map and add it to a MapView

    const map = new Map({
      basemap: "gray-vector"
    });

    view = new MapView({
      container: "viewDiv",
      map: map,
      center: [-98.77,29.94],
      zoom: 6
    });

    // Create FeatureLayer instance with popupTemplate

    const layer = new FeatureLayer({
      url:
        "https://services9.arcgis.com/DvQdTfZkjSPKyAGe/arcgis/rest/services/Poverty_texas_demoData/FeatureServer",
      popupTemplate: {
        // autocasts as new PopupTemplate()
        title: "<strong>Poverty Data<strong>",
        content:"{Pop_in_pov} of {Population} are living in poverty situation in {CNTY_NM}, {DIST_NM}, TX",
        fieldInfos: [
          {
            fieldName: "Pop_in_pov",
            format: {
              digitSeparator: true,
              places: 0
            }
          },
          {
            fieldName: "Population",
            format: {
              digitSeparator: true,
              places: 0
            }
          }
        ]
      }
    });

    watchUtils.whenFalseOnce(view, "updating", generateRenderer);

    function generateRenderer() {
      // configure parameters for the color renderer generator
      // the layer must be specified along with a field name
      // or arcade expression. The view and other properties determine
      // the appropriate default color scheme.

      const colorParams = {
        layer: layer,
        valueExpression:
          "$feature.Pov_percen",
        view: view,
        theme: "above-and-below",
        outlineOptimizationEnabled: true
      };

      // Generate a continuous color renderer based on the
      // statistics of the data in the provided layer
      // and field normalized by the normalizationField.
      //
      // This resolves to an object containing several helpful
      // properties, including color scheme, statistics,
      // the renderer and visual variable

      let rendererResult;

      colorRendererCreator
        .createContinuousRenderer(colorParams)
        .then(function (response) {
          // set the renderer to the layer and add it to the map
          rendererResult = response;
          layer.renderer = rendererResult.renderer;

          if (!map.layers.includes(layer)) {
            map.add(layer);
          }

          // generate a histogram for use in the slider. Input the layer
          // and field or arcade expression to generate it.

          return histogram({
            layer: layer,
            valueExpression: colorParams.valueExpression,
            view: view,
            numBins: 70
          });
        })
        .then(function (histogramResult) {
          // Construct a color slider from the result of both
          // smart mapping renderer and histogram methods
          const colorSlider = ColorSlider.fromRendererResult(
            rendererResult,
            histogramResult
          );
          colorSlider.container = "slider";
          colorSlider.primaryHandleEnabled = true;
          // Round labels to 1 decimal place
          colorSlider.labelFormatFunction = function (value, type) {
            return value.toFixed(1);
          };
          // styles the standard deviation lines to be shorter
          // than the average line
          colorSlider.histogramConfig.dataLineCreatedFunction = function (
            lineElement,
            labelElement,
            index
          ) {
            if (index != null) {
              lineElement.setAttribute("x2", "66%");
              const sign = index === 0 ? "-" : "+";
              labelElement.innerHTML = sign + "σ";
            }
          };
          colorSlider.viewModel.precision = 1;
          view.ui.add("containerDiv", "bottom-left");

          // when the user slides the handle(s), update the renderer
          // with the updated color visual variable object

          function changeEventHandler() {
            const renderer = layer.renderer.clone();
            const colorVariable = renderer.visualVariables[0].clone();
            const outlineVariable = renderer.visualVariables[1];
            colorVariable.stops = colorSlider.stops;
            renderer.visualVariables = [colorVariable, outlineVariable];
            layer.renderer = renderer;
          }

          colorSlider.on(
            ["thumb-change", "thumb-drag", "min-change", "max-change"],
            changeEventHandler
          );
        })
        .catch(function (error) {
          console.log("there was an error: ", error);
        });
    }
  });