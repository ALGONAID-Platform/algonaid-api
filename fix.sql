ALTER ROLE postgres LOGIN SUPERUSER;
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP 
        EXECUTE 'ALTER TABLE public."' || r.tablename || '" OWNER TO postgres;'; 
    END LOOP; 
END $$;
