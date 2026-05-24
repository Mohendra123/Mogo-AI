/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("scvkc6zq31zvncy")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_admin_campaigns_old_id` ON `admin_campaigns` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_admin_campaigns_old_id` ON `admin_campaigns` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_admin_campaigns_old_id` ON `admin_campaigns` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("scvkc6zq31zvncy")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_admin_campaigns_old_id` ON `admin_campaigns` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_admin_campaigns_old_id` ON `admin_campaigns` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
