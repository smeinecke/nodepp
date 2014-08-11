var chai = require('chai');

var expect = chai.expect,
should = chai.should;

var EppFactory = require('../lib/epp-factory.js');
var mainConfig = require('../lib/epp-config-devel.json');

describe('EPP serialisation', function() {

    describe('general commands', function() {
        var epp, config;
        beforeEach(function() {
            config = mainConfig['hexonet-test1'];
            epp = EppFactory.generate('hexonet-test1', config);
        });
        it('should be an epp object with hexonet config', function() {
            expect(epp).to.be.an.instanceof(Object);
            expect(config.namespaces.epp.xmlns).to.be.equal('urn:ietf:params:xml:ns:epp-1.0');
        });
        it('should render an "authInfo" section', function() {
            var authData = {
                pw: 'teStPass',
                roid: 'P-12345'
            };
            var processedData = epp.processAuthInfo(authData, 'domain');
            var xml = epp.callConvert(processedData, 'test');
            //console.log(xml);
            expect(xml).to.match(/<domain:pw roid="P-12345">teStPass<\/domain:pw>/);
            var authNoRoidData = {
                pw: 'teStPass'
            };
            var processedNoRoid = epp.processAuthInfo(authNoRoidData, 'contact');
            xml = epp.callConvert(processedNoRoid, 'test');
            expect(xml).to.match(/<contact:pw>teStPass<\/contact:pw>/);

            var plainAuthInfo = 'teStPass';
            var processedPlainAuthInfo = epp.processAuthInfo(plainAuthInfo, 'contact');
            xml = epp.callConvert(processedPlainAuthInfo, 'test');
            expect(xml).to.match(/<contact:pw>teStPass<\/contact:pw>/);

        });
        it('should process different types of period data', function() {
            var periodData = 3;
            var processedData = epp.processDomainPeriod(periodData);
            expect(processedData._attr.unit).to.equal("y");
            expect(processedData._value).to.equal(periodData);

            var twelveMonthPeriod = {
                "unit": "m",
                "value": 12
            };
            var processedTwelveMonth = epp.processDomainPeriod(twelveMonthPeriod);
            expect(processedTwelveMonth._attr.unit).to.equal("m");
            expect(processedTwelveMonth._value).to.equal(twelveMonthPeriod.value);

            var unspecifiedUnit = {
                "value": 2
            };
            var processUnspecUnit = epp.processDomainPeriod(unspecifiedUnit);
            expect(processUnspecUnit._attr.unit).to.equal('y');

        });
        it('should process arrays of IPs for domain:hostAddr and host:addr objects', function() {
            var nameserver_addr1 = "255.255.255.255";
            var nameserver_addr2 = ["255.255.255.255", {
                "ip": "254.254.254.254"
            },
            {
                "ip": "::F5::E2",
                "type": "v6"
            }];
            var processedIps1 = epp.processIPAddrObjects(nameserver_addr1);
            expect(processedIps1).to.deep.equal([{
                "_attr": {
                    "ip": "v4"
                },
                "_value": nameserver_addr1
            }]);
            var processedIps2 = epp.processIPAddrObjects(nameserver_addr2);
            expect(processedIps2[2]).to.deep.equal({
                "_attr": {
                    "ip": "v6"
                },
                "_value": "::F5::E2"
            });

        });
        it('should preprocess nameserver information', function() {
            var nameservers1 = ["ns1.test.com", "ns2.test.com", "ns3.test.com"];
            var nameservers2 = [{
                "host": "ns2.test.com"
            },
            {
                "host": "ns3.test.com",
                "addr": "255.255.255.255"
            },
            {
                "host": "ns4.test.com",
                "addr": ["255.255.255.255", {
                    "ip": "254.254.254.254"
                },
                {
                    "ip": "::F5::E2",
                    "type": "v6"
                }]
            }];
            var processedNameservers1 = epp.processDomainNS(nameservers1);
            expect(processedNameservers1).to.deep.equal({
                "domain:hostObj": nameservers1
            });
            var processedNameservers2 = epp.processDomainNS(nameservers2);
            expect(processedNameservers2["domain:hostAttr"][2]["domain:hostName"]).to.equal('ns4.test.com');
            expect(processedNameservers2["domain:hostAttr"][2]["domain:hostAddr"][2]._value).to.equal('::F5::E2');

        });
        it('should throw an error if a nameserver obj has no host', function() {
            var nameservers2 = [{
                "addr": "255.255.255.255"
            },
            ];
            var processNameserverTest = function() {
                var processedNameservers2 = epp.processDomainNS(nameservers2);
            };
            expect(processNameserverTest).to.
            throw ("Host required in nameserver object!");

        });
        it('should generate an xml body', function() {
            var xml = epp.login({
                "login": "user1",
                "password": "abc123"
            },
            'test-1234');
            //console.log("Got xml: ", xml);
            expect(xml).to.match(/<login>/);
        });

        it('should generate a hello command', function() {
            var xml = epp.hello();
            //console.log("Got hello: ", xml);
            expect(xml).to.match(/<hello\/>/);
        });

        it('should generate a logout command', function() {
            var xml = epp.logout('test-1235');
            //console.log("Got logout: ", xml);
            expect(xml).to.match(/<logout\/>/);
        });

        it('should generate a checkDomain command', function() {
            var xml = epp.checkDomain({
                "domain": "test-domain.com"
            },
            'test-12345');
            expect(xml).to.match(/<check>(?:(?!<domain:name>).)*<domain:name>test-domain.com/);
        });

        it('should generate a createContact command', function() {
            var contactData = {

                "id": "auto",
                "voice": "+1.9405551234",
                "fax": "+1.9405551233",
                "email": "john.doe@null.com",
                "authInfo": {
                    "pw": "xyz123"
                },
                "disclose": {
                    "flag": 0,
                    "disclosing": ["voice", "email"]
                },
                "postalInfo": [{
                    "name": "John Doe",
                    "org": "Example Ltd",
                    "type": "int",
                    "addr": [{
                        "street": ["742 Evergreen Terrace", "Apt b"],
                        "city": "Springfield",
                        "sp": "OR",
                        "pc": "97801",
                        "cc": "US"
                    }]
                }]
            };
            var xml = epp.createContact(contactData, 'test-12345');
            //console.log("Got xml: ", xml);
            expect(xml).to.match(/xmlns:contact=\"urn:ietf:params:xml:ns:contact-1.0\"/);
            expect(xml).to.match(/<contact:name>John Doe<\/contact:name>/);
            expect(xml).to.match(/<contact:addr>(?:(?!<contact:city>).)*<contact:city>Springfield/);
            expect(xml).to.match(/<contact:disclose(?:(?!<contact:email>).)*<contact:email\/>/);
        });

        it('should generate a "deleteContact" command', function() {
            var deleteContact = {
                "id": "p-13243"
            };
            var xml = epp.deleteContact(deleteContact, 'test-1234');
            expect(xml).to.match(/<contact:id>(?:(?!<\/contact:id).)*p-13243<\/contact:id/);

        });

        it('should generate an "update contact" command', function() {
            var updateData = {
                id: "p-12345",
                add: ['clientDeleteProhibited'],
                rem: ['clientTransferProhibited'],
                chg: {
                    "postalInfo": [{
                        "name": "John Doe",
                        "org": "Example Ltd",
                        "type": "loc",
                        "addr": [{
                            "street": ["742 Evergreen Terrace", "Apt b"],
                            "city": "Eugene",
                            "sp": "OR",
                            "pc": "97801",
                            "cc": "US"
                        }]
                    }],
                    "voice": "+1.9405551234",
                    "fax": "+1.9405551233",
                    "email": "john.doe@null.com",
                    "authInfo": {
                        "pw": "xyz123"
                    },
                    "disclose": {
                        "flag": 0,
                        "disclosing": ["voice", "email"]
                    }
                }
            };
            var xml = epp.updateContact(updateData, 'test-1234');
            //console.log("Got xml: ", xml);
            expect(xml).to.match(/<contact:status\ss=\"clientDeleteProhibited\"/);
            expect(xml).to.match(/<contact:status\ss=\"clientTransferProhibited\"/);
            expect(xml).to.match(/<contact:chg>(?:(?!<\/contact:chg>).)*<\/contact:chg>/);
        });

        it('should generate a create domain command', function() {
            var createDomain = {
                "name": "test-domain.com",
                "period": {
                    "unit": "y",
                    "value": 2
                },
                "ns": ["ns1.example.net", "ns2.example.net"],
                "registrant": "P-12345",
                "contact": [{
                    "admin": "P-12345"
                },
                {
                    "tech": "P-12346"
                },
                ],
                "authInfo": {
                    "pw": "Axri3kjp"
                }
            };
            var xml = epp.createDomain(createDomain, 'test-14989');
            //console.log(xml);
            expect(xml).to.match(/<domain:name>test-domain\.com<\/domain:name>/);
            expect(xml).to.match(/<domain:registrant>P-12345<\/domain:registrant/);
        });

        it('should generate a "deleteDomain" command', function() {
            var deleteDomain = {
                "name": "my-delete-domain.com"
            };
            var xml = epp.deleteDomain(deleteDomain, 'test-1234');
            expect(xml).to.match(/<domain:name>(?:(?!<\/domain:name).)*my-delete-domain.com<\/domain:name/);

        });

        it('should generate a transfer domain command', function() {
            var transferDomain = {
                "name": "test-domain.com",
                "op": "request",
                "period": 1,
                "authInfo": {
                    "roid": "P-12345",
                    "pw": "2fooBAR"
                }
            };
            var xml = epp.transferDomain(transferDomain, 'test-1234');
            expect(xml).to.match(/<transfer op="request"/);

            var transferReject = {
                "name": "test-domain.com",
                "op": "reject",
                "authInfo": {
                    "roid": "P-12345",
                    "pw": "2fooBAR"
                }
            };
            xml = epp.transferDomain(transferReject, 'test-1234');
            expect(xml).to.match(/<transfer op="reject"/);
        });

        it('should throw exception if op incorrect', function() {
            var transferDomain = {
                "name": "test-domain.com",
                "op": "yipee",
                "period": 1,
                "authInfo": {
                    "roid": "P-12345",
                    "pw": "2fooBAR"
                }
            };
            var throwsError = function() {
                epp.transferDomain(transferDomain, 'test-1234');
            };
            expect(throwsError).to.
            throw ('Transfer domain op must be one of the following: [approve, cancel, query, reject, request].');
        });

        it('should throw exception if no authInfo pw supplied', function() {
            var transferDomain = {
                "name": "test-domain.com",
                "op": "request",
                "period": 1,
                "authInfo": {
                    "roid": "P-12345",
                }
            };
            var throwsError = function() {
                epp.transferDomain(transferDomain, 'test-1234');
            };
            expect(throwsError).to.
            throw ('pw is required!');
        });
        it('should render update domain', function() {
            var updateDomain1 = {
                "name": "test-domain.com",
                "add": {
                    "ns": ["ns3.test.com", "ns4.whatever.com"],
                    "contact": [{
                        "admin": "P-9876"
                    },
                    {
                        "billing": "PX143"
                    }],
                    "status": ["clientUpdateProhibited", {
                        "s": "clientHold",
                        "lang": "en",
                        "value": "Payment Overdue"
                    }]
                },
                "rem": {
                    "ns": [{
                        "host": "ns1.test-domain.com",
                        "addr": {
                            "type": "v4",
                            "ip": "192.68.2.132"
                        }
                    }],
                    "contact": [{
                        "billing": "PX147"
                    }],
                    "status": ["clientTransferProhibited", {
                        "s": "clientWhatever",
                        "lang": "en",
                        "value": "Payment Overdue"
                    }]
                },
                "chg": {
                    "registrant": "P-49023",
                    "authInfo": {
                        "pw": "TestPass2"
                    }
                }
            };
            var xml = epp.updateDomain(updateDomain1, 'test-12346');
            expect(xml).to.match(/<domain:add>(?:(?!<\/domain:add).)*ns4.whatever.com/);
            expect(xml).to.match(/<domain:rem>(?:(?!<\/domain:rem).)*ns1.test-domain.com/);
            expect(xml).to.match(/<domain:chg>(?:(?!<\/domain:registrant>).)*P-49023/);

        });

        it('should create a createHost command', function() {
            var createHost = {
                "name": "ns1.host.com",
                "addr": ["23.84.43.123", {
                    "ip": "22.4.22.5"
                },
                {
                    "ip": "::F3:34::BA:",
                    "type": "v6"
                }]
            };
            var xml = epp.createHost(createHost, 'test-1234');
            expect(xml).to.match(/<host:name>(?:(?!<\/host:name).)*ns1.host.com/);
        });

        it('should create an updateHost command', function() {
            var updateHost = {
                "name": "ns1.host.com",
                "chg": {
                    "name": "ns2.host.com",
                },
                "add": {
                    "addr": {
                        "ip": "::F3:34::BA:",
                        "type": "v6"
                    },
                    "status": ["clientUpdateProhibited"]
                },
                "rem": {
                    "addr": ["23.84.43.123", {
                        "ip": "22.4.22.5"
                    }],
                    "status": ["clientTransferProhibited", "sneezeAchoo"]
                }
            };
            var xml = epp.updateHost(updateHost, 'test-1234');
            expect(xml).to.match(/<host:rem>(?:(?!<\/host:rem).)*clientTransferProhibited/);
        });
    });

    describe('extension handling', function() {
        var epp, config;
        beforeEach(function() {
            config = mainConfig['nzrs-test1'];
            epp = EppFactory.generate('nzrs-test1', config);
        });
        it('should be decorated with the secDNS extension methods', function() {
            expect(epp).to.respondTo('createDomainSecDnsExtension');
            expect(epp).to.respondTo('updateDomainSecDnsExtension');
        });

        it('should convert createDomain secDNS data into structure with xmlns', function() {

            var secDnsData = {
                "maxSigLife": 604800,
                "dsData": {
                    "keyTag": 12345,
                    "alg": 3,
                    "digestType": 1,
                    "digest": "49FD46E6C4B45C55D4AC"
                }
            };
            var processedDSData = epp.createDomainSecDnsExtension(secDnsData);
            expect(processedDSData).to.have.deep.property("secDNS:create.secDNS:dsData.secDNS:digest", "49FD46E6C4B45C55D4AC");

            secDnsData.dsData.keyData = {
                "flags": 257,
                "protocol": 3,
                "alg": 1,
                "pubKey": "AQPJ////4Q=="
            };
            var processedWithKeyData = epp.createDomainSecDnsExtension(secDnsData);
            expect(processedWithKeyData).to.have.deep.property("secDNS:create.secDNS:dsData.secDNS:keyData.secDNS:pubKey", "AQPJ////4Q==");

            var secDnsKeyData = {
                "keyData": {
                    "flags": 257,
                    "protocol": 3,
                    "alg": 1,
                    "pubKey": "AQPJ////4Q=="
                }
            };
            var processedKeyData = epp.createDomainSecDnsExtension(secDnsKeyData);
            expect(processedKeyData).to.have.deep.property("secDNS:create.secDNS:keyData.secDNS:pubKey", "AQPJ////4Q==");

        });

        it('should handle DNSSEC update data structures', function() {
            var secDnsUpdate = {
                "add": {
                    "dsData": {
                        "keyTag": 12345,
                        "alg": 3,
                        "digestType": 1,
                        "digest": "49FD46E6C4B45C55D4AC"
                    }
                },
                "rem": {
                    "keyData": {
                        "flags": 257,
                        "protocol": 3,
                        "alg": 1,
                        "pubKey": "AQPJ////4Q=="
                    }
                },
                "chg": {
                    "maxSigLife": 604800
                }
            };
            var processedUpdate = epp.updateDomainSecDnsExtension(secDnsUpdate);
            expect(processedUpdate).to.have.deep.property("secDNS:update.secDNS:rem.secDNS:keyData.secDNS:pubKey", "AQPJ////4Q==");
            expect(processedUpdate).to.have.deep.property("secDNS:update.secDNS:chg.secDNS:maxSigLife", 604800);
        });
        it('should ignore any other data when secDNS:rem contains "all".', function() {
            var secDnsUpdate = {
                "add": {
                    "dsData": {
                        "keyTag": 12345,
                        "alg": 3,
                        "digestType": 1,
                        "digest": "49FD46E6C4B45C55D4AC"
                    }
                },
                "rem": {
                    "all": true,
                    "keyData": {
                        "flags": 257,
                        "protocol": 3,
                        "alg": 1,
                        "pubKey": "AQPJ////4Q=="
                    }
                },
                "chg": {
                    "maxSigLife": 604800
                }
            };
            var processedUpdate = epp.updateDomainSecDnsExtension(secDnsUpdate);
            expect(processedUpdate).to.not.have.deep.property("secDNS:update.secDNS:rem.secDNS:keyData");
            expect(processedUpdate).to.have.deep.property("secDNS:update.secDNS:rem.secDNS:all", "true");
            var secDnsUpdate2 = {
                "rem": {
                    "all": 'goodtimes',
                },
            };
            var testCrash   = function () {
             epp.updateDomainSecDnsExtension(secDnsUpdate2);
            };
            expect(testCrash).to.throw("'all' must be a boolean or truthy number.");

        });
    });
    describe('Hexonet extension', function() {
        var hexonetEpp, config;
        beforeEach(function() {
            config = mainConfig['hexonet-test1'];
            hexonetEpp = EppFactory.generate('hexonet-test1', config);
        });
        it('should be decorated with the secDNS extension methods', function() {
            expect(hexonetEpp).to.respondTo('createDomainExtension');
        });
        it('should process Hexonet "keyvalue" extension', function() {
            var keyValueData = {
                "X-ASIA-CED-ACCEPT-TRUSTEE-TAC": "1",
                "OWNERCONTACT1": "P-TAF28517",
                "OWNERCONTACT2": "P-TAF28559"
            };
            var processedExtension = hexonetEpp.createDomainExtension(keyValueData);
            expect(processedExtension).to.have.deep.property("keyvalue:extension.keyvalue:kv[1]._attr.value", "P-TAF28517");
            expect(processedExtension).to.have.deep.property("keyvalue:extension.keyvalue:kv[2]._attr.key", "OWNERCONTACT2");
        });
    });
});

