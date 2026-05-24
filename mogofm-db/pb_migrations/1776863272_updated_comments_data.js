/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mkw6l9nbn93539p")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_comments_data_old_id` ON `comments_data` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mkw6l9nbn93539p")

  collection.indexes = []

  return dao.saveCollection(collection)
})
