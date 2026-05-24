/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("x6bhvt9c5w0p18e")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_watch_history_old_id` ON `watch_history` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_watch_history_old_id` ON `watch_history` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_watch_history_old_id` ON `watch_history` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_watch_history_old_id` ON `watch_history` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("x6bhvt9c5w0p18e")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_watch_history_old_id` ON `watch_history` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_watch_history_old_id` ON `watch_history` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_watch_history_old_id` ON `watch_history` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
