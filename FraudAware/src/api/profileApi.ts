import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type {
  EducationRequest,
  LanguageRequest,
  ProfileResponse,
  UpdateBasicProfileRequest,
  WorkExperienceRequest,
} from '../types/profile';
import {
  appendDocumentField,
  appendFormField,
  appendImageField,
} from '../utils/formDataHelpers';
async function parseError(response: Response, fallback: string): Promise<never> {
  try {
    const error = await response.json();
    throw new Error(error.message || fallback);
  } catch (err) {
    if (err instanceof Error && err.message !== fallback) throw err;
    throw new Error(fallback);
  }
}

export async function getMyProfile(token: string): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/me`, {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to fetch profile');
  }

  return response.json();
}

export async function updateBasicProfile(
  token: string,
  payload: UpdateBasicProfileRequest
): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/basic`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to update profile');
  }

  return response.json();
}

export async function updateSummary(
  token: string,
  summary: string
): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/summary`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary }),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to update summary');
  }

  return response.json();
}

export async function updateSkills(
  token: string,
  skills: string[]
): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/skills`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ skills }),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to update skills');
  }

  return response.json();
}

function buildImageFormData(fieldName: string, imageUri: string): FormData {
  const form = new FormData();
  appendImageField(form, fieldName, imageUri);
  return form;
}

function buildWorkExperienceFormData(
  payload: WorkExperienceRequest,
  logoUri?: string | null
): FormData {
  const form = new FormData();
  appendFormField(form, 'role', payload.role);
  appendFormField(form, 'company', payload.company);
  appendFormField(form, 'startDate', payload.startDate);
  if (payload.isCurrentlyWorking) {
    appendFormField(form, 'isCurrentlyWorking', true);
  } else if (payload.endDate) {
    appendFormField(form, 'endDate', payload.endDate);
    appendFormField(form, 'isCurrentlyWorking', false);
  }
  appendFormField(form, 'description', payload.description);
  appendFormField(form, 'location', payload.location);
  if (logoUri) appendImageField(form, 'logo', logoUri);
  return form;
}

function buildEducationFormData(
  payload: EducationRequest,
  logoUri?: string | null
): FormData {
  const form = new FormData();
  appendFormField(form, 'degree', payload.degree);
  appendFormField(form, 'institution', payload.institution);
  appendFormField(form, 'fieldOfStudy', payload.fieldOfStudy);
  appendFormField(form, 'startDate', payload.startDate);
  appendFormField(form, 'endDate', payload.endDate);
  appendFormField(form, 'description', payload.description);
  if (logoUri) appendImageField(form, 'logo', logoUri);
  return form;
}
export async function updateAvatar(
  token: string,
  imageUri: string
): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/avatar`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: buildImageFormData('avatar', imageUri),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to update avatar');
  }

  return response.json();
}

export async function addWorkExperience(
  token: string,
  payload: WorkExperienceRequest,
  logoUri?: string | null
): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/work-experience`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildWorkExperienceFormData(payload, logoUri),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to add work experience');
  }

  return response.json();
}

export async function updateWorkExperience(
  token: string,
  itemId: string,
  payload: WorkExperienceRequest,
  logoUri?: string | null
): Promise<ProfileResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/work-experience/${itemId}`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: buildWorkExperienceFormData(payload, logoUri),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to update work experience');
  }

  return response.json();
}

export async function deleteWorkExperience(
  token: string,
  itemId: string
): Promise<ProfileResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/work-experience/${itemId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to delete work experience');
  }

  return response.json();
}

export async function addEducation(
  token: string,
  payload: EducationRequest,
  logoUri?: string | null
): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/education`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildEducationFormData(payload, logoUri),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to add education');
  }

  return response.json();
}

export async function updateEducation(
  token: string,
  itemId: string,
  payload: EducationRequest,
  logoUri?: string | null
): Promise<ProfileResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/education/${itemId}`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: buildEducationFormData(payload, logoUri),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to update education');
  }

  return response.json();
}

export async function deleteEducation(
  token: string,
  itemId: string
): Promise<ProfileResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/education/${itemId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to delete education');
  }

  return response.json();
}

function buildLanguageFormData(
  payload: LanguageRequest,
  flagImageUri?: string | null
): FormData {
  const form = new FormData();
  appendFormField(form, 'name', payload.name);
  appendFormField(form, 'proficiency', payload.proficiency);
  if (flagImageUri) appendImageField(form, 'logo', flagImageUri);
  return form;
}

export async function addLanguage(
  token: string,
  payload: LanguageRequest,
  flagImageUri?: string | null
): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/languages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildLanguageFormData(payload, flagImageUri),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to add language');
  }

  return response.json();
}

export async function updateLanguage(
  token: string,
  itemId: string,
  payload: LanguageRequest,
  flagImageUri?: string | null
): Promise<ProfileResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/languages/${itemId}`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: buildLanguageFormData(payload, flagImageUri),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to update language');
  }

  return response.json();
}

export async function deleteLanguage(
  token: string,
  itemId: string
): Promise<ProfileResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/languages/${itemId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to delete language');
  }

  return response.json();
}

export async function uploadCv(
  token: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  isPrimary = false
): Promise<ProfileResponse> {
  const form = new FormData();
  appendDocumentField(form, 'cv', fileUri, fileName, mimeType);
  appendFormField(form, 'isPrimary', isPrimary);

  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/cv`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });

  if (!response.ok) {
    await parseError(response, 'Failed to upload CV');
  }

  return response.json();
}

export async function deleteCv(token: string, cvId: string): Promise<ProfileResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/cv/${cvId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to delete CV');
  }

  return response.json();
}
