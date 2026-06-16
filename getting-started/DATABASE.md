# Database in Sesi

Sesi ships with a lightweight embedded document database via the `std/db` module. It stores records as JSON documents, supports full CRUD operations, and can optionally encrypt the database file at rest.

---

## Opening a Database

Import `db_open` from `std/db` and call it with a filename:

```sesi
allow "std/db" in with {db_open}

let db = db_open("data.db")
```

The file is created automatically if it does not exist.

---

## Encryption

Pass a second argument to encrypt the database with AES-256-CBC. The passphrase is used on every read and write:

```sesi
let db = db_open("data.db", "my-secret-passphrase")
```

Without the correct passphrase, the file is unreadable.

---

## Collections

A collection is a named group of documents — similar to a table in a relational database. Call `.collection()` on the database instance to open or create one:

```sesi
let users = db.collection("users")
```

All CRUD operations are performed on the collection object.

---

## Insert

Add a document to the collection. If the document does not have an `_id` field, one is generated automatically:

```sesi
users.insert({"name": "Ada", "role": "admin", "active": true})
users.insert({"name": "Grace", "role": "developer", "active": true})
```

`insert` returns the inserted document including its `_id`.

---

## Find

Retrieve documents that match a query object. All fields in the query must match:

```sesi
// Find all documents
let all = users.find()

// Find by a field value
let admins = users.find({"role": "admin"})

for user in admins {
  print user["name"]
}
```

---

## Update

Update all documents matching a query. Returns the number of documents updated:

```sesi
let count = users.update({"name": "Ada"}, {"role": "lead"})
print "Updated:" count
```

---

## Delete

Delete all documents matching a query. Returns the number of documents deleted:

```sesi
let count = users.delete({"active": false})
print "Deleted:" count
```

---

## Wrapping in `try/catch`

All database operations can throw on failure. Wrap them in `try/catch` for resilient scripts:

```sesi
allow "std/db" in with {db_open}

try {
  let db    = db_open("data.db", "passphrase")
  let posts = db.collection("posts")

  posts.insert({"title": "Hello Sesi", "views": 0})

  let results = posts.find({"title": "Hello Sesi"})
  print results[0]["title"]
} catch (err) {
  print "Database error:" err
}
```

---

## Quick Reference

```sesi
allow "std/db" in with {db_open}

// Open (or create) a database
let db = db_open("store.db")

// With encryption
let db = db_open("store.db", "passphrase")

// Open a collection
let items = db.collection("items")

// Insert
items.insert({"name": "Widget", "qty": 10})

// Find all
let all = items.find()

// Find by query
let matches = items.find({"name": "Widget"})

// Update
items.update({"name": "Widget"}, {"qty": 20})

// Delete
items.delete({"qty": 0})
```

---
