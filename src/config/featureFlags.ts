export const FEATURE_FLAGS = {
  photos: true as boolean,
};

export function isPhotosEnabled(): boolean {
  return FEATURE_FLAGS.photos;
}
