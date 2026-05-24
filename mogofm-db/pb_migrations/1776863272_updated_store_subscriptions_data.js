/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mk8u1t51ifja3v4")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_store_subscriptions_data_old_id` ON `store_subscriptions_data` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mk8u1t51ifja3v4")

  collection.indexes = []

  return dao.saveCollection(collection)
})
