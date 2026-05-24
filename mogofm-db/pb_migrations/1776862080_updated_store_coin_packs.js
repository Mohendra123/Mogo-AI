/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mmxi3spvws1ly51")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_store_coin_packs_old_id` ON `store_coin_packs` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_store_coin_packs_old_id` ON `store_coin_packs` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mmxi3spvws1ly51")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_store_coin_packs_old_id` ON `store_coin_packs` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
