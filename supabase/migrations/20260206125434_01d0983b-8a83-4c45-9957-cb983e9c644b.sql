-- Add parent_id to categories for sub-category support (hierarchical nesting)
ALTER TABLE public.categories 
ADD COLUMN parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- Add index for faster hierarchical queries
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);