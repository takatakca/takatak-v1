-- Plan freeze: extra Brands hide instead of delete.
-- Over-quota scheduled posts wait until the plan allows them.
ALTER TYPE "BrandStatus" ADD VALUE IF NOT EXISTS 'frozen';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'blocked_by_plan';
