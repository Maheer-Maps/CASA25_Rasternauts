// Phase 1: Compute Incident Metrics and Export Intermediate Asset
// -------------------------------------------------------------

// This two-phase approach reduces memory usage to avoid exceeding GEE's user memory limits.


// Section 1: Import Datasets
// -------------------------

// Import Nepal district boundaries as a FeatureCollection (for spatial join and area computation)
var districts = ee.FeatureCollection("projects/ee-testing-casa-25/assets/districts");

// Verify the number of districts loaded
print('Number of districts loaded:', districts.size());

// Import historical landslide points with incident data
var landslidePoints = ee.FeatureCollection("projects/ee-testing-casa-25/assets/landslides_data_v1");

// Verify the number of landslide points loaded
print('Number of landslide points loaded:', landslidePoints.size());

// Import population data
var populationData = ee.FeatureCollection("projects/ee-testing-casa-25/assets/nepal_district_population_census");

// Verify the number of population data entries
print('Number of population data entries:', populationData.size());

// Section 2: Fix Typos in District Names
// -------------------------------------

// Define a dictionary for district name corrections
var nameCorrections = ee.Dictionary({
  'CHITAWAN': 'CHITWAN',
  'KABHREPALANCHOK': 'KAVREPALANCHOK',
  'MAKAWANPUR': 'MAKWANPUR',
  'TANAHU': 'TANAHUN',
  'KAPILBASTU': 'KAPILVASTU',
  'RUKUM_E': 'RUKUM EAST',
  'RUKUM_W': 'RUKUM WEST',
  'NAWALPARASI_W': 'NAWALPARASI WEST',
  'NAWALPARASI_E': 'NAWALPARASI EAST',
  'SINDHUPALCHOK': 'SINDHUPALCHOWK',
  'TERHATHUM': 'TEHRATHUM',
  'DHANUSHA': 'DHANUSA'
});

// Apply the corrections to the district names (for populationJoin)
districts = districts.map(function(feature) {
  var districtName = ee.String(feature.get('DISTRICT'));
  var correctedName = ee.Algorithms.If(
    nameCorrections.contains(districtName),
    nameCorrections.get(districtName),
    districtName
  );
  return feature.set('DISTRICT', correctedName);
});

// Section 3: Join Population Data with Districts
// ---------------------------------------------

// Normalize district names in population data to uppercase for joining
populationData = populationData.map(function(feature) {
  return feature.set('District', ee.String(feature.get('District')).toUpperCase());
});

// Join population data with districts using district names
var populationJoin = ee.Join.saveFirst({
  matchKey: 'populationData',
  ordering: 'DISTRICT'
}).apply({
  primary: districts,
  secondary: populationData,
  condition: ee.Filter.equals({
    leftField: 'DISTRICT',
    rightField: 'District'
  })
});

// Verify the number of districts after population join
print('Number of districts after population join:', populationJoin.size());

// Section 4: Compute Incident Metrics Using Spatial Join
// -----------------------------------------------------

// Compute historical incident metrics by joining landslide points to districts
var incidentCountsJoined = ee.Join.saveAll({
  matchesKey: 'incidents',
  ordering: 'system:index'
}).apply({
  primary: populationJoin,
  secondary: landslidePoints,
  condition: ee.Filter.intersects({
    leftField: '.geo',
    rightField: '.geo'
  })
});

// Get the list of district names before and after the spatial join
var districtsBeforeJoin = populationJoin.aggregate_array('DISTRICT');
var districtsAfterJoin = incidentCountsJoined.aggregate_array('DISTRICT');

// Identify dropped districts
var droppedDistricts = districtsBeforeJoin.filter(ee.Filter.inList('item', districtsAfterJoin).not());
print('Districts dropped during spatial join:', droppedDistricts);

// Reintroduce dropped districts with default incident metrics
var droppedFeatures = populationJoin.filter(ee.Filter.inList('DISTRICT', droppedDistricts))
  .map(function(feature) {
    return feature.set({
      'incidents': ee.List([]) // Empty list for dropped districts
    });
  });

// Combine the joined features with the dropped features
var incidentCounts = incidentCountsJoined.merge(droppedFeatures);

// Verify the number of districts after reintroducing dropped districts
print('Number of districts after reintroducing dropped districts:', incidentCounts.size());

// Section 5: Compute Initial Metrics
// ---------------------------------

var districtFactors = incidentCounts.map(function(district) {
  var districtGeom = district.geometry();
  var districtName = district.get('DISTRICT');
  var incidentsList = ee.List(district.get('incidents'));
  var incidents = ee.FeatureCollection(incidentsList); // Convert ee.List to ee.FeatureCollection

  // Historical incident metrics
  var incidentCount = incidents.size();
  var deaths = incidentCount.gt(0) ? incidents.aggregate_sum('peopleDeathCount') : ee.Number(0);
  var injuries = incidentCount.gt(0) ? incidents.aggregate_sum('peopleInjuredCount') : ee.Number(0);
  var infraDestroyed = incidentCount.gt(0) ? incidents.aggregate_sum('infrastructureDestroyedCount') : ee.Number(0);

  // Compute district area in km², handling invalid geometries
  var area_km2 = ee.Number(ee.Algorithms.If(
    districtGeom,
    ee.Algorithms.If(
      districtGeom.area().gt(0),
      districtGeom.area().divide(1e6), // Convert m² to km²
      0
    ),
    0 // Default to 0 if geometry is null
  ));

  // Get population data from the joined population layer
  var populationFeature = ee.Feature(district.get('populationData'));
  var totalPopulation = ee.Number(populationFeature.get('Population 21')).max(0); // Updated field name

  // Return a feature with computed factors (excluding raster-based metrics for now)
  return ee.Feature(districtGeom, {
    'DISTRICT': districtName,
    'incidentCount': incidentCount,
    'deaths': deaths,
    'injuries': injuries,
    'infraDestroyed': infraDestroyed,
    'totalPopulation': totalPopulation,
    'area_km2': area_km2
  });
});

// Verify the number of districts before export
print('Number of districts before export:', districtFactors.size());

// Verify values for the 4 dropped districts (had no reported incidents)
var droppedDistrictsList = ee.List(["BARA", "DHANUSA", "RAUTAHAT", "SAPTARI"]);
var droppedDistrictsFactors = districtFactors.filter(ee.Filter.inList('DISTRICT', droppedDistrictsList));
print('Values for dropped districts (BARA, DHANUSA, RAUTAHAT, SAPTARI):', droppedDistrictsFactors);

// Print a sample of the output for verification
print('First few district factors (Phase 1):', districtFactors.limit(5));

// Export the intermediate FeatureCollection
Export.table.toAsset({
  collection: districtFactors,
  description: 'NepalDistrictFactors_Intermediate',
  assetId: 'projects/ee-testing-casa-25/assets/NepalDistrictFactors_Intermediate'
});