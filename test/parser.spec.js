/* global describe, before, it */
const { expect } = require('chai');
const Parser = require('../parser');
const parsedData = require('./data/parsed');
require('mocha');

describe('Parser Tests', () => {
  let parser;
  before('Initialize parser', () => {
    const filePath = 'test/data/timing.log';
    parser = new Parser(filePath, 10);
  });

  it('Should parse line content', () => {
    const logline = '2015-08-19 00:04:25,474 (http--0.0.0.0-28080-405) [USER:300402244999] /mainContent.do?action=SUBSCRIPTION&msisdn=300402244999&contentId=main_subscription in 14';
    const parsed = parser.parseContent(logline);
    expect(parsed).to.be.an('object').and.have.keys(['timestamp', 'threadId', 'userContext', 'duration', 'resource', 'params']);
    expect(parsed.params).to.be.an('array').and.have.length(3);
  });

  it('Should open and parse file', () => parser.parseFile()
    .then(() => {
      const result = parser.dataset;
      expect(result).to.be.an('array').and.have.length(1001);
      expect(result[0]).to.be.an('object').and.have.keys(['timestamp', 'threadId', 'userContext', 'duration', 'resource', 'params']);
    }));

  it('Should calculate average durations for resources', () => {
    parser.calculateAverageDuration(parsedData);
    const result = parser.toplist;
    expect(result).to.be.an('array').and.have.length(10);
    result.reduce((prev, curr) => {
      expect(prev).to.be.an('object').and.have.keys(['resource', 'average']);
      expect(prev.average).to.be.at.least(curr.average);
      return curr;
    }, { resource: 'dummy', average: Number.MAX_SAFE_INTEGER });
  });

  it('Should map hourly requests', () => {
    parser.mapHourlyRequests(parsedData);
    const result = parser.hourlyRequests;
    expect(result).to.be.an('array');
    expect(result[0]).to.be.an('object').and.have.keys(['hour', 'requests']);
  });

  it('Should print histogram', () => {
    const dataSet = [
      { hour: '00', requests: Math.floor(Math.random() * 1000) + 1 },
      { hour: '01', requests: Math.floor(Math.random() * 1000) + 1 },
      { hour: '02', requests: Math.floor(Math.random() * 1000) + 1 },
      { hour: '05', requests: Math.floor(Math.random() * 1000) + 1 },
      { hour: '09', requests: Math.floor(Math.random() * 1000) + 1 },
      { hour: '15', requests: Math.floor(Math.random() * 1000) + 1 },
      { hour: '19', requests: Math.floor(Math.random() * 1000) + 1 },
      { hour: '22', requests: Math.floor(Math.random() * 1000) + 1 },
      { hour: '23', requests: Math.floor(Math.random() * 1000) + 1 },
    ];
    parser.printHistogram(dataSet);
  });
});
