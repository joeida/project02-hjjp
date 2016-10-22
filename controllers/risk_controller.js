const models = require('../models');
const express = require('express');
const Q = require('q');
const isos = require('countries-iso');
const natural = require('../js/crimeTableCalculator');
const safezone = require('../js/safezone');
const weather = require('../js/weather');

const router = express.Router();

// Returns a random integer between min (included) and max (included)
// Using Math.round() will give you a non-uniform distribution!
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

router.get('/risk', function(req, res) {
    var locationArray = JSON.parse(req.query.locs);
    var overview = false;
    if ('overview' in req.query) {
        var overview = true;
        locationArray = [locationArray];
    }
    console.log(locationArray);
    var locationCounter = 0;

    var riskFactors = {
        crime: 0,
        weather: 1,
        safehouses: 2,
        natural: 3
    };

    locationArray.forEach(function(location) {
        var locationAddress = location.address;
        var splitAddress = locationAddress.split(', ');
        var countryName = splitAddress[splitAddress.length - 1].trim();
        var countryISO = isos[countryName]; // 'ECU'

        Q.allSettled([
            models.Biological.findAll({where: {ISO: countryISO}}),
            models.Climatological.findAll({where: {ISO: countryISO}}),
            models.Geophysical.findAll({where: {ISO: countryISO}}),
            models.Hydrological.findAll({where: {ISO: countryISO}}),
            models.Metrological.findAll({where: {ISO: countryISO}}),
            safezone.getSafezonesNumber(location),
            weather.getWeatherData(location.lat, location.lng)
        ]).then(function (searchResults) {
            var randomNumber = getRandomIntInclusive(0,100);
            var riskCalc = 0;
            for (var tableNum = 0; tableNum < searchResults.length; tableNum++) {
                var tableArray = [];
                if (tableNum < 5) {
                    var rows = searchResults[tableNum].value.length;
                    var curRows = searchResults[tableNum].value;
                    for (var rowNum = 0; rowNum < rows; rowNum++){
                        var rowObj = {
                            totalDeaths: curRows[rowNum].totalDeaths,
                            totalAffected: curRows[rowNum].totalAffected
                         }
                         tableArray.push(rowObj);
                    }
                    riskFactors.natural = natural.calculate(tableArray);
                } else {
                    if (tableNum === 5) {
                        riskFactors.safehouses = searchResults[tableNum].value.length;
                    }
                    if (tableNum === 6) {
                        riskFactors.weather = searchResults[tableNum].value;
                    }
                }

            }
            location.risk = riskCalc;
            locationCounter++;
            if (locationCounter === locationArray.length) {
                if (overview) {
                    res.send(riskFactors);
                } else {
                    res.send(locationArray);
                }
            }
        });
    });
});

module.exports = router;
