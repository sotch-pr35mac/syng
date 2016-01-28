var SqliteToMongo = require('..');

describe("Connecting to an sqlite file and mongodb", function () {
  it("Sould connect to a given sqlite file and then to a local mongodb", function () {

    //var importer = new SqliteToMongo('spec/zresources/tables.sqlite', 'mongodb://localhost/');
    //
    expect(false).not.toBe(true);
  });
  it("Sould connect to a given sqlite file and then to a remote mongodb");
  it("Sould connect to a given sqlite file and then to a replicaset of mongodb");
});

describe('importer', function () {
  describe('presets', function () {
    it('Should call functions for each row when given as a preset', function () {
      var collectionDummy = {};
      var actual = []

      collectionDummy.insert = function (document) {
        return actual.push(document);
      };

      SqliteToMongo.prototype.mongoDb = {};

      SqliteToMongo.prototype.mongoDb.collection = function(name) {
        return collectionDummy;
      };

      SqliteToMongo.prototype._handleSqliteRow('tests', {columns: {'column1': 'field'},
                                                        presets: { _id: function() { return 1; } } }, null, {'column1': 'test'});

      expect(actual[0]._id).toBe(1);

    });
  });
});
