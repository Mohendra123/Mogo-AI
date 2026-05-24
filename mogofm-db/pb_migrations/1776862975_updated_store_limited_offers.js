/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("zvgm91gltg2izel")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_store_limited_offers_old_id` ON `store_limited_offers` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_store_limited_offers_old_id` ON `store_limited_offers` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_store_limited_offers_old_id` ON `store_limited_offers` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_store_limited_offers_old_id` ON `store_limited_offers` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("zvgm91gltg2izel")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_store_limited_offers_old_id` ON `store_limited_offers` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_store_limited_offers_old_id` ON `store_limited_offers` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_store_limited_offers_old_id` ON `store_limited_offers` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
