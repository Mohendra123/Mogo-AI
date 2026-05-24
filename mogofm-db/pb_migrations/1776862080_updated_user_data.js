/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("oct9krysgtdw66c")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_user_data_old_id` ON `user_data` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_data_old_id` ON `user_data` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("oct9krysgtdw66c")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_user_data_old_id` ON `user_data` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
