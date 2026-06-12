/*
  # Add product status and user profile fields

  1. Modified Tables
    - `products`
      - Added `status` column (text, 'Aktif' or 'Nonaktif', default 'Aktif')
    - `users_profile`
      - Added `address` column (text, default empty)
      - Added `phone` column (text, default empty)
      - Added `avatar_url` column (text, default empty)

  2. Important Notes
    - Products with status 'Nonaktif' cannot be ordered if stock > 0 (enforced at app level)
    - User profile gains address, phone, and avatar fields for self-service editing
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'status'
  ) THEN
    ALTER TABLE products ADD COLUMN status text NOT NULL DEFAULT 'Aktif';
    ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status = ANY (ARRAY['Aktif'::text, 'Nonaktif'::text]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_profile' AND column_name = 'address'
  ) THEN
    ALTER TABLE users_profile ADD COLUMN address text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_profile' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users_profile ADD COLUMN phone text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_profile' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users_profile ADD COLUMN avatar_url text NOT NULL DEFAULT '';
  END IF;
END $$;
