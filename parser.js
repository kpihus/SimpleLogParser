/* eslint-disable no-console */
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const _ = require('lodash');

class Parser {
  constructor(filePath, topLenght) {
    this.filePath = path.join(__dirname, filePath);
    this.topLenght = topLenght || 10;
    this.dataset = null;
    this.toplist = null;
    this.hourlyRequests = null;
    this.regexPatterns = {
      timestamp: /[0-9]{1,4}-[0-9]{1,2}-[0-9]{1,2}\s[0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2},[0-9]{1,3}/g,
      threadId: /(?<=\().*(?=\))/g,
      userContext: /(?<=\[)[a-zA-Z0-9]*:[a-zA-Z0-9]*(?=\])/g,
      duration: /(?<=in\s)\d+/g,
      resource: /(?<=\/)[a-zA-Z0-9]*.[a-zA-Z0-9]*(?=(\?|\s))/g, // substypechange.do
      params: /(?<=(\?|&))[a-zA-Z0-9_-]*=[a-zA-Z0-9_-]*(?=(&|\s))/g, // ?action=SUBSCRIPTION_USER&msisdn=300553344974&contentId=main_subscription
    };
  }

  parseContent(line) {
    const result = {};
    Object.keys(this.regexPatterns).forEach((key) => {
      const matches = line.match(this.regexPatterns[key]);
      result[key] = matches && matches.length < 2 ? matches[0] : matches;
    });
    return result;
  }

  parseFile() {
    const dataset = [];
    return new Promise((resolve) => {
      const rd = readline.createInterface({
        input: fs.createReadStream(this.filePath),
      });
      rd.on('line', (line) => {
        dataset.push(this.parseContent(line));
      });
      rd.on('close', () => {
        this.dataset = dataset;
        resolve();
      });
    });
  }

  calculateAverageDuration() {
    const { dataset } = this;
    const durations = [];

    dataset.forEach((item) => {
      const existingItem = durations.find((storedItem) => storedItem.resource === item.resource);

      if (!existingItem) {
        durations.push({
          resource: item.resource,
          timings: [parseInt(item.duration, 10)],
        });
      } else {
        existingItem.timings.push(parseInt(item.duration, 10));
      }
    });
    this.toplist = durations
      .map((item) => {
        const numberOfSamples = item.timings.length;
        const timingSum = item.timings.reduce((prev, curr) => prev + curr, 0);
        return {
          resource: item.resource,
          average: Math.round(timingSum / numberOfSamples),
        };
      })
      .sort((a, b) => b.average - a.average)
      .slice(0, this.topLenght);
  }

  printTopList() {
    console.log('\n');
    console.log(`Top ${this.topLenght} slowest resources:`);
    console.table(this.toplist);
  }

  mapHourlyRequests() {
    const { dataset } = this;
    const result = [];
    dataset.forEach((item) => {
      const hour = moment(item.timestamp, 'YYYY-MM-DD HH:mm:ss,SSS').format('HH');
      const existing = result.find((resultItem) => resultItem.hour === hour);

      if (!existing) {
        result.push({
          hour,
          requests: 1,
        });
      } else {
        existing.requests += 1;
      }
    });
    this.hourlyRequests = result;
  }

  printHistogram() {
    let dataset = this.hourlyRequests;
    const boundaries = { min: 0, max: 70 };
    // eslint-disable-next-line no-mixed-operators
    const map = (value, x1, y1, x2, y2) => Math.floor((value - x1) * (y2 - x2) / (y1 - x1) + x2);
    for (let i = 0; i < 24; i += 1) {
      const hourExists = dataset.find((item) => parseInt(item.hour, 10) === i);

      if (!hourExists) {
        dataset.push({ hour: i, requests: 0 });
      }
    }

    dataset = dataset
      .map((item) => ({ hour: parseInt(item.hour, 10), requests: item.requests }))
      .sort((a, b) => a.hour - b.hour);

    const minimum = _.minBy(dataset, (item) => item.requests).requests;
    const maximum = _.maxBy(dataset, (item) => item.requests).requests;

    dataset = dataset.map((item) => {
      const barLength = map(item.requests, minimum, maximum, boundaries.min, boundaries.max);
      let bar = '';

      for (let i = 0; i <= barLength; i += 1) {
        bar += '*';
      }

      return Object.assign(item, { bar });
    });
    console.log('\n');
    console.log('Hourly graph of requests:');
    console.log('hr | requests');
    console.log('-----------------------------------------------------------------------------------------------------');
    dataset.forEach((item) => {
      if (item.hour < 10) {
        console.log(`${item.hour}  | ${item.bar} (${item.requests})`);
      } else {
        console.log(`${item.hour} | ${item.bar} (${item.requests})`);
      }
    });
    console.log('-----------------------------------------------------------------------------------------------------');
  }
}

function printHelpText() {
  console.log('usage: node parser.js [filename] [n]');
  console.log('filename: name of the logfile');
  console.log('n: number of items on top slowest resources list');
}

console.time('duration');

const args = process.argv;

if (args[1].indexOf('mocha') < 0) {
  // Run only if not invoked from testSuite
  if (args[2] === '-h' || args[2] === '--help') {
    printHelpText();
    process.exit(0);
  } else {
    const fileName = args[2];
    const topLength = args[3];
    const parser = new Parser(fileName, topLength);

    parser.parseFile()
      .then(() => {
        parser.calculateAverageDuration();
        parser.printTopList();
        parser.mapHourlyRequests();
        parser.printHistogram();
        console.timeEnd('duration');
        process.exit(0);
      });
  }
}

module.exports = Parser;
