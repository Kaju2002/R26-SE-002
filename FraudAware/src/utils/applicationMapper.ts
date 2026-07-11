import type { ApplicationListItem } from '../../data/applicationNotifications';
import type { ApiApplication } from '../api/jobApi';

/** Map job-management application shape to frontend ApplicationListItem. */
export function mapApiApplicationToListItem(
  application: ApiApplication
): ApplicationListItem {
  return {
    id: application.id,
    jobTitle: application.jobTitle,
    companyName: application.companyName,
    status: application.status,
    logo: application.companyLogoUri
      ? { uri: application.companyLogoUri }
      : undefined,
    fallback: application.companyFallback,
  };
}

export function mapApiApplicationsToListItems(
  applications: ApiApplication[]
): ApplicationListItem[] {
  return applications.map(mapApiApplicationToListItem);
}
