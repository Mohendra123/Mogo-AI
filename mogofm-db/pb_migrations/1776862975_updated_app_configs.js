/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("zvgp4rjf25sxu5m")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_app_configs_old_id` ON `app_configs` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_configs_old_id` ON `app_configs` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_configs_old_id` ON `app_configs` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_configs_old_id` ON `app_configs` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("zvgp4rjf25sxu5m")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_app_configs_old_id` ON `app_configs` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_configs_old_id` ON `app_configs` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_app_configs_old_id` ON `app_configs` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
