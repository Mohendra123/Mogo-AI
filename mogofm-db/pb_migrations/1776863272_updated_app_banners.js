/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("y2ttd4rlk07ak32")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("y2ttd4rlk07ak32")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_banners_old_id` ON `app_banners` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
