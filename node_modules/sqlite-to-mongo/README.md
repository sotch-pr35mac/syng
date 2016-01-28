# sqlite-to-mongo
This is a node package that will help you move your data from sqlite to MongoDB

## Basic Usage
```
const SqliteToMongo = require('sqlite-to-mongo');

var importer = new SqliteToMongo('db.sqlite', 'mongodb://localhost/dbname');

importer.importCollection('users', {
  tableName : "USERS_TABLE",
  columns: {
    ID: '_id',
    USERNAME: 'username',
    EMAIL : 'profile.email'
  }
});

```

## Import from a given query
```
importer.importCollection('books', {
  query:  'select a.author_name author, b.id id, b.bookname book ' +
          'from authors_table a left ' + 
          'outer join books_table b ' + 
          'on b.author_id = a.id  ',
  columns: {
    id: '_id',
    book: 'name',
    author : 'author'
  }
});
```

## Import with preset values
```
importer.importCollection('books', {
  query:  'select a.author_name author, b.id id, b.bookname book ' +
          'from authors_table a left ' + 
          'outer join books_table b ' + 
          'on b.author_id = a.id',
  columns: {
    id: '_id',
    book: 'name',
    author : 'author'
  },
  presets: {
    publisher: 'Barnes and Noble'
  }
});
```

## Import and update based on values from the query
```
importer.importCollection('books', {
  query:  'select a.author_name author, b.id id, b.bookname book, b.price price' +
          'from authors_table a left ' + 
          'outer join books_table b ' + 
          'on b.author_id = a.id',
  columns: {
    id: '_id',
    book: 'name',
    author : 'author',
    price: 'price'
  },
  selector: {
    '_id': 'id'
  }
});
```

## Custom Callback
```
importer.importCollection('users', {
  tableName : "USERS_TABLE",
    columns: {
      ID: '_id',
      USERNAME: 'username',
      EMAIL : 'profile.email'
    }
  },
  /**
   * Called after operation has finished. 
   *
   * @param err   Can be empty.
   * @param num   Number of total operations.
   */
  function (err, num) {
    if (err) throw new Error(err);
    
    console.log('Number of operations:', num);
  }
);
```
