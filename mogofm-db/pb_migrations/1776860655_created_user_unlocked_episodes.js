/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "r828jk8l1ktbm1n",
    "created": "2026-04-22 12:24:15.443Z",
    "updated": "2026-04-22 12:24:15.443Z",
    "name": "user_unlocked_episodes",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "i6oaifsi",
        "name": "old_id",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "mrwnjyxk",
        "name": "user_id",
        "type": "relation",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "oct9krysgtdw66c",
          "cascadeDelete": false,
          "minSelect": 0,
          "maxSelect": 1,
          "displayFields": null
        }
      },
      {
        "system": false,
        "id": "ieqed76k",
        "name": "user_id_old",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "un0rmg6h",
        "name": "series_id",
        "type": "relation",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "6m2xuyw4xegw6ex",
          "cascadeDelete": false,
          "minSelect": 0,
          "maxSelect": 1,
          "displayFields": null
        }
      },
      {
        "system": false,
        "id": "pbyua2k8",
        "name": "series_id_old",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "sl28t3yn",
        "name": "episode_id",
        "type": "relation",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "c9w66klqyhsu57o",
          "cascadeDelete": false,
          "minSelect": 0,
          "maxSelect": 1,
          "displayFields": null
        }
      },
      {
        "system": false,
        "id": "a0e9bqcm",
        "name": "episode_id_old",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "rtjajmxy",
        "name": "unlocked_at",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "1cw4xrgu",
        "name": "unlock_method",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("r828jk8l1ktbm1n");

  return dao.deleteCollection(collection);
})
