/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("4qil24slb4cl65e")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("4qil24slb4cl65e")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_notifications_old_id` ON `user_notifications` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
