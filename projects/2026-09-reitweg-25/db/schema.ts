import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const entries=sqliteTable("design_entries",{
 id:text("id").primaryKey(), owner:text("owner").notNull(), project:text("project").notNull(), kind:text("kind").notNull(), content:text("content").notNull(), version:integer("version").notNull().default(1), createdAt:text("created_at").notNull(), updatedAt:text("updated_at").notNull()
},table=>[index("idx_entries_owner_project").on(table.owner,table.project)]);
