export const FEATURE_FLAGS = {
  photos: false as boolean,
};

export function isPhotosEnabled(): boolean {
  return FEATURE_FLAGS.photos;
}
