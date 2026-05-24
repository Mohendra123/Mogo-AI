/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("lk038qg63z2po13")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("lk038qg63z2po13")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_unlocked_content_old_id` ON `unlocked_content` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
