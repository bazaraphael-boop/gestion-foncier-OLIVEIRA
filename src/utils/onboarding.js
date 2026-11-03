// First sign-in guide: remembered per account on each device (components/OnboardingTour.jsx)

const STORAGE_PREFIX = 'geocadastre_onboarding_done_';

export function shouldShowOnboarding(userId) {
  try {
    return !!userId && localStorage.getItem(STORAGE_PREFIX + userId) !== '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone(userId) {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, '1');
  } catch {
    // Storage unavailable: shown again next time
  }
}
