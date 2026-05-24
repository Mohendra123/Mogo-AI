/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("wl15109bfj1hewu")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "y4ao24fz",
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
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("wl15109bfj1hewu")

  // remove
  collection.schema.removeField("y4ao24fz")

  return dao.saveCollection(collection)
})
