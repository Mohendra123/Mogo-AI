/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("r828jk8l1ktbm1n")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_user_unlocked_episodes_old_id` ON `user_unlocked_episodes` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_unlocked_episodes_old_id` ON `user_unlocked_episodes` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_unlocked_episodes_old_id` ON `user_unlocked_episodes` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("r828jk8l1ktbm1n")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_user_unlocked_episodes_old_id` ON `user_unlocked_episodes` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_user_unlocked_episodes_old_id` ON `user_unlocked_episodes` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
