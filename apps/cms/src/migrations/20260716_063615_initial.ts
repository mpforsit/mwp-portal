import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE SCHEMA IF NOT EXISTS "cms";
  CREATE TYPE "cms"."enum_users_role" AS ENUM('admin', 'redaktion', 'arzt');
  CREATE TYPE "cms"."enum_articles_sources_ref_type" AS ENUM('doi', 'pubmed', 'url');
  CREATE TYPE "cms"."enum_articles_evidenzgrad" AS ENUM('hoch', 'mittel', 'niedrig', 'unklar');
  CREATE TYPE "cms"."enum_articles_review_status" AS ENUM('in_arbeit', 'redaktionell_fertig', 'medizinisch_geprueft');
  CREATE TYPE "cms"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__articles_v_version_sources_ref_type" AS ENUM('doi', 'pubmed', 'url');
  CREATE TYPE "cms"."enum__articles_v_version_evidenzgrad" AS ENUM('hoch', 'mittel', 'niedrig', 'unklar');
  CREATE TYPE "cms"."enum__articles_v_version_review_status" AS ENUM('in_arbeit', 'redaktionell_fertig', 'medizinisch_geprueft');
  CREATE TYPE "cms"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "cms"."users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "cms"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"qualification" varchar,
  	"role" "cms"."enum_users_role" DEFAULT 'redaktion' NOT NULL,
  	"medic_profile_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_content_url" varchar,
  	"sizes_content_width" numeric,
  	"sizes_content_height" numeric,
  	"sizes_content_mime_type" varchar,
  	"sizes_content_filesize" numeric,
  	"sizes_content_filename" varchar
  );
  
  CREATE TABLE "cms"."medics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"title" varchar,
  	"specialty" varchar NOT NULL,
  	"photo_id" integer,
  	"bio" varchar,
  	"practice_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."articles_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"frage" varchar,
  	"antwort" varchar
  );
  
  CREATE TABLE "cms"."articles_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"citation" varchar,
  	"ref_type" "cms"."enum_articles_sources_ref_type",
  	"ref" varchar
  );
  
  CREATE TABLE "cms"."articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"category_id" integer,
  	"author_id" integer,
  	"excerpt" varchar,
  	"kernaussage" varchar,
  	"evidenzgrad" "cms"."enum_articles_evidenzgrad",
  	"content" jsonb,
  	"messgroesse_biomarker" varchar,
  	"messgroesse_referenzbereich" varchar,
  	"messgroesse_intervall" varchar,
  	"requires_medical_review" boolean DEFAULT true,
  	"review_status" "cms"."enum_articles_review_status" DEFAULT 'in_arbeit',
  	"review_reviewed_by_id" integer,
  	"review_review_date" timestamp(3) with time zone,
  	"review_review_note" varchar,
  	"last_fact_check" timestamp(3) with time zone,
  	"content_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_articles_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_articles_v_version_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"frage" varchar,
  	"antwort" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_articles_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"citation" varchar,
  	"ref_type" "cms"."enum__articles_v_version_sources_ref_type",
  	"ref" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_articles_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_category_id" integer,
  	"version_author_id" integer,
  	"version_excerpt" varchar,
  	"version_kernaussage" varchar,
  	"version_evidenzgrad" "cms"."enum__articles_v_version_evidenzgrad",
  	"version_content" jsonb,
  	"version_messgroesse_biomarker" varchar,
  	"version_messgroesse_referenzbereich" varchar,
  	"version_messgroesse_intervall" varchar,
  	"version_requires_medical_review" boolean DEFAULT true,
  	"version_review_status" "cms"."enum__articles_v_version_review_status" DEFAULT 'in_arbeit',
  	"version_review_reviewed_by_id" integer,
  	"version_review_review_date" timestamp(3) with time zone,
  	"version_review_review_note" varchar,
  	"version_last_fact_check" timestamp(3) with time zone,
  	"version_content_hash" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__articles_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."podcast_episodes_transcript" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"speaker" varchar NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."podcast_episodes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"episode_number" numeric NOT NULL,
  	"podigee_episode_id" varchar NOT NULL,
  	"publish_date" timestamp(3) with time zone NOT NULL,
  	"show_notes" jsonb,
  	"audio_url" varchar,
  	"category_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."podcast_episodes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );
  
  CREATE TABLE "cms"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"medics_id" integer,
  	"categories_id" integer,
  	"articles_id" integer,
  	"podcast_episodes_id" integer
  );
  
  CREATE TABLE "cms"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "cms"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."newsletter_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Der Newsletter zum Podcast' NOT NULL,
  	"intro" varchar DEFAULT 'Neue Folgen, neue Artikel und was sich an der Studienlage geändert hat — per E-Mail, ohne Umwege.' NOT NULL,
  	"datenschutzhinweis" varchar DEFAULT 'Anmeldung mit Double-Opt-in; Abmeldung jederzeit über den Link in jeder E-Mail. Gespeichert werden die E-Mail-Adresse und das Themeninteresse der Seite, über die die Anmeldung erfolgte — keine weiteren Daten. Details in der Datenschutzerklärung.' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."transparency_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"intro" varchar DEFAULT 'Dieses Portal verdient Geld. Wie, womit und was das für die Inhalte bedeutet, steht auf dieser Seite — vollständig und laufend aktualisiert.' NOT NULL,
  	"affiliate" varchar DEFAULT 'In der Vergleichs-Zone verwenden wir Affiliate-Links: Kommt ein Kauf über einen gekennzeichneten Link zustande, erhalten wir eine Provision. Die Bewertung folgt einer dokumentierten, versionierten Methodik und ist von der Vergütung unabhängig — gelistet werden auch Anbieter ohne Partnerprogramm. Ob das stimmt, muss niemand glauben: Die Korrelation zwischen Ranking und Vergütung veröffentlichen wir unten als Zahl.' NOT NULL,
  	"metalytic" varchar DEFAULT 'MetaLytic (Bluttest-Kits) gehört zum selben Unternehmensverbund wie dieses Portal. Wir empfehlen Messung vor Supplementierung, weil die Evidenz es so sagt — und ja, wir verdienen daran. Testergebnisse verbleiben vollständig bei MetaLytic und berühren weder dieses Portal noch Newsletter oder Reichweitenmessung.' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "cms"."users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."users" ADD CONSTRAINT "users_medic_profile_id_medics_id_fk" FOREIGN KEY ("medic_profile_id") REFERENCES "cms"."medics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."medics" ADD CONSTRAINT "medics_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles_faq" ADD CONSTRAINT "articles_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."articles_sources" ADD CONSTRAINT "articles_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_review_reviewed_by_id_medics_id_fk" FOREIGN KEY ("review_reviewed_by_id") REFERENCES "cms"."medics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v_version_faq" ADD CONSTRAINT "_articles_v_version_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v_version_sources" ADD CONSTRAINT "_articles_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_author_id_users_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_review_reviewed_by_id_medics_id_fk" FOREIGN KEY ("version_review_reviewed_by_id") REFERENCES "cms"."medics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."podcast_episodes_transcript" ADD CONSTRAINT "podcast_episodes_transcript_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."podcast_episodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."podcast_episodes" ADD CONSTRAINT "podcast_episodes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "cms"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."podcast_episodes_rels" ADD CONSTRAINT "podcast_episodes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."podcast_episodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."podcast_episodes_rels" ADD CONSTRAINT "podcast_episodes_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "cms"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_medics_fk" FOREIGN KEY ("medics_id") REFERENCES "cms"."medics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "cms"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_podcast_episodes_fk" FOREIGN KEY ("podcast_episodes_id") REFERENCES "cms"."podcast_episodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "cms"."users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "cms"."users_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "users_slug_idx" ON "cms"."users" USING btree ("slug");
  CREATE INDEX "users_medic_profile_idx" ON "cms"."users" USING btree ("medic_profile_id");
  CREATE INDEX "users_updated_at_idx" ON "cms"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "cms"."users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "cms"."users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "cms"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "cms"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "cms"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "cms"."media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_content_sizes_content_filename_idx" ON "cms"."media" USING btree ("sizes_content_filename");
  CREATE UNIQUE INDEX "medics_slug_idx" ON "cms"."medics" USING btree ("slug");
  CREATE INDEX "medics_photo_idx" ON "cms"."medics" USING btree ("photo_id");
  CREATE INDEX "medics_updated_at_idx" ON "cms"."medics" USING btree ("updated_at");
  CREATE INDEX "medics_created_at_idx" ON "cms"."medics" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "cms"."categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "cms"."categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "cms"."categories" USING btree ("created_at");
  CREATE INDEX "articles_faq_order_idx" ON "cms"."articles_faq" USING btree ("_order");
  CREATE INDEX "articles_faq_parent_id_idx" ON "cms"."articles_faq" USING btree ("_parent_id");
  CREATE INDEX "articles_sources_order_idx" ON "cms"."articles_sources" USING btree ("_order");
  CREATE INDEX "articles_sources_parent_id_idx" ON "cms"."articles_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "cms"."articles" USING btree ("slug");
  CREATE INDEX "articles_category_idx" ON "cms"."articles" USING btree ("category_id");
  CREATE INDEX "articles_author_idx" ON "cms"."articles" USING btree ("author_id");
  CREATE INDEX "articles_review_review_reviewed_by_idx" ON "cms"."articles" USING btree ("review_reviewed_by_id");
  CREATE INDEX "articles_updated_at_idx" ON "cms"."articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "cms"."articles" USING btree ("created_at");
  CREATE INDEX "articles__status_idx" ON "cms"."articles" USING btree ("_status");
  CREATE INDEX "_articles_v_version_faq_order_idx" ON "cms"."_articles_v_version_faq" USING btree ("_order");
  CREATE INDEX "_articles_v_version_faq_parent_id_idx" ON "cms"."_articles_v_version_faq" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_sources_order_idx" ON "cms"."_articles_v_version_sources" USING btree ("_order");
  CREATE INDEX "_articles_v_version_sources_parent_id_idx" ON "cms"."_articles_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_parent_idx" ON "cms"."_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "cms"."_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_category_idx" ON "cms"."_articles_v" USING btree ("version_category_id");
  CREATE INDEX "_articles_v_version_version_author_idx" ON "cms"."_articles_v" USING btree ("version_author_id");
  CREATE INDEX "_articles_v_version_review_version_review_reviewed_by_idx" ON "cms"."_articles_v" USING btree ("version_review_reviewed_by_id");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "cms"."_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "cms"."_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "cms"."_articles_v" USING btree ("version__status");
  CREATE INDEX "_articles_v_created_at_idx" ON "cms"."_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "cms"."_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_latest_idx" ON "cms"."_articles_v" USING btree ("latest");
  CREATE INDEX "podcast_episodes_transcript_order_idx" ON "cms"."podcast_episodes_transcript" USING btree ("_order");
  CREATE INDEX "podcast_episodes_transcript_parent_id_idx" ON "cms"."podcast_episodes_transcript" USING btree ("_parent_id");
  CREATE INDEX "podcast_episodes_category_idx" ON "cms"."podcast_episodes" USING btree ("category_id");
  CREATE INDEX "podcast_episodes_updated_at_idx" ON "cms"."podcast_episodes" USING btree ("updated_at");
  CREATE INDEX "podcast_episodes_created_at_idx" ON "cms"."podcast_episodes" USING btree ("created_at");
  CREATE INDEX "podcast_episodes_rels_order_idx" ON "cms"."podcast_episodes_rels" USING btree ("order");
  CREATE INDEX "podcast_episodes_rels_parent_idx" ON "cms"."podcast_episodes_rels" USING btree ("parent_id");
  CREATE INDEX "podcast_episodes_rels_path_idx" ON "cms"."podcast_episodes_rels" USING btree ("path");
  CREATE INDEX "podcast_episodes_rels_articles_id_idx" ON "cms"."podcast_episodes_rels" USING btree ("articles_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_medics_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("medics_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_podcast_episodes_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("podcast_episodes_id");
  CREATE INDEX "payload_preferences_key_idx" ON "cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "cms"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "cms"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."users_sessions" CASCADE;
  DROP TABLE "cms"."users" CASCADE;
  DROP TABLE "cms"."media" CASCADE;
  DROP TABLE "cms"."medics" CASCADE;
  DROP TABLE "cms"."categories" CASCADE;
  DROP TABLE "cms"."articles_faq" CASCADE;
  DROP TABLE "cms"."articles_sources" CASCADE;
  DROP TABLE "cms"."articles" CASCADE;
  DROP TABLE "cms"."_articles_v_version_faq" CASCADE;
  DROP TABLE "cms"."_articles_v_version_sources" CASCADE;
  DROP TABLE "cms"."_articles_v" CASCADE;
  DROP TABLE "cms"."podcast_episodes_transcript" CASCADE;
  DROP TABLE "cms"."podcast_episodes" CASCADE;
  DROP TABLE "cms"."podcast_episodes_rels" CASCADE;
  DROP TABLE "cms"."payload_kv" CASCADE;
  DROP TABLE "cms"."payload_locked_documents" CASCADE;
  DROP TABLE "cms"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "cms"."payload_preferences" CASCADE;
  DROP TABLE "cms"."payload_preferences_rels" CASCADE;
  DROP TABLE "cms"."payload_migrations" CASCADE;
  DROP TABLE "cms"."newsletter_settings" CASCADE;
  DROP TABLE "cms"."transparency_settings" CASCADE;
  DROP TYPE "cms"."enum_users_role";
  DROP TYPE "cms"."enum_articles_sources_ref_type";
  DROP TYPE "cms"."enum_articles_evidenzgrad";
  DROP TYPE "cms"."enum_articles_review_status";
  DROP TYPE "cms"."enum_articles_status";
  DROP TYPE "cms"."enum__articles_v_version_sources_ref_type";
  DROP TYPE "cms"."enum__articles_v_version_evidenzgrad";
  DROP TYPE "cms"."enum__articles_v_version_review_status";
  DROP TYPE "cms"."enum__articles_v_version_status";`)
}
