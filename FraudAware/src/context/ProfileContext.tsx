import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  addEducation as addEducationApi,
  addLanguage as addLanguageApi,
  addWorkExperience as addWorkExperienceApi,
  deleteCv as deleteCvApi,
  deleteEducation as deleteEducationApi,
  deleteLanguage as deleteLanguageApi,
  deleteWorkExperience as deleteWorkExperienceApi,
  getMyProfile,
  updateAvatar as updateAvatarApi,
  updateBasicProfile as updateBasicProfileApi,
  updateCompanyLogo as updateCompanyLogoApi,
  updateEducation as updateEducationApi,
  updateLanguage as updateLanguageApi,
  updateSkills as updateSkillsApi,
  updateSummary as updateSummaryApi,
  updateWorkExperience as updateWorkExperienceApi,
  uploadCv as uploadCvApi,
} from '../api/profileApi';
import type {
  EducationRequest,
  LanguageRequest,
  ProfileDetailsData,
  UpdateBasicProfileRequest,
  UserProfile,
  WorkExperienceRequest,
} from '../types/profile';
import { useUser } from './UserContext';

const EMPTY_DETAILS: ProfileDetailsData = {
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  languages: [],
  cvFiles: [],
};

export interface ProfileContextValue {
  profile: UserProfile | null;
  details: ProfileDetailsData;
  isLoading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateBasicProfile: (payload: UpdateBasicProfileRequest) => Promise<void>;
  updateAvatar: (imageUri: string) => Promise<void>;
  updateCompanyLogo: (imageUri: string) => Promise<void>;
  updateSummary: (summary: string) => Promise<void>;
  updateSkills: (skills: string[]) => Promise<void>;
  addWorkExperience: (
    payload: WorkExperienceRequest,
    logoUri?: string | null
  ) => Promise<void>;
  updateWorkExperience: (
    itemId: string,
    payload: WorkExperienceRequest,
    logoUri?: string | null
  ) => Promise<void>;
  deleteWorkExperience: (itemId: string) => Promise<void>;
  addEducation: (payload: EducationRequest, logoUri?: string | null) => Promise<void>;
  updateEducation: (
    itemId: string,
    payload: EducationRequest,
    logoUri?: string | null
  ) => Promise<void>;
  deleteEducation: (itemId: string) => Promise<void>;
  addLanguage: (payload: LanguageRequest, flagImageUri?: string | null) => Promise<void>;
  updateLanguage: (
    itemId: string,
    payload: LanguageRequest,
    flagImageUri?: string | null
  ) => Promise<void>;
  deleteLanguage: (itemId: string) => Promise<void>;
  uploadCv: (
    fileUri: string,
    fileName: string,
    mimeType: string,
    isPrimary?: boolean
  ) => Promise<void>;
  deleteCv: (cvId: string) => Promise<void>;
  clearProfile: () => void;
  clearError: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return ctx;
}

function applyProfileResponse(
  setProfile: (p: UserProfile | null) => void,
  setDetails: (d: ProfileDetailsData) => void,
  data: { profile: UserProfile; details: ProfileDetailsData }
) {
  setProfile(data.profile);
  setDetails(data.details);
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { token, clearSession } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [details, setDetails] = useState<ProfileDetailsData>(EMPTY_DETAILS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearProfile = useCallback(() => {
    setProfile(null);
    setDetails(EMPTY_DETAILS);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!token) {
      clearProfile();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getMyProfile(token);
      applyProfileResponse(setProfile, setDetails, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile';
      setError(message);
      if (
        message.includes('Session expired') ||
        message.includes('Please login') ||
        message.includes('Invalid token') ||
        message.includes('Token expired')
      ) {
        await clearSession();
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [token, clearProfile, clearSession]);

  const updateBasicProfile = useCallback(
    async (payload: UpdateBasicProfileRequest) => {
      if (!token) throw new Error('Not authenticated');

      try {
        setIsLoading(true);
        setError(null);
        const data = await updateBasicProfileApi(token, payload);
        applyProfileResponse(setProfile, setDetails, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update profile';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const updateAvatar = useCallback(
    async (imageUri: string) => {
      if (!token) throw new Error('Not authenticated');

      try {
        setIsLoading(true);
        setError(null);
        const data = await updateAvatarApi(token, imageUri);
        applyProfileResponse(setProfile, setDetails, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update avatar';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const updateCompanyLogo = useCallback(
    async (imageUri: string) => {
      if (!token) throw new Error('Not authenticated');

      try {
        setIsLoading(true);
        setError(null);
        const data = await updateCompanyLogoApi(token, imageUri);
        applyProfileResponse(setProfile, setDetails, data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update company logo';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const updateSummary = useCallback(
    async (summary: string) => {
      if (!token) throw new Error('Not authenticated');

      try {
        setIsLoading(true);
        setError(null);
        const data = await updateSummaryApi(token, summary);
        applyProfileResponse(setProfile, setDetails, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update summary';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const updateSkills = useCallback(
    async (skills: string[]) => {
      if (!token) throw new Error('Not authenticated');

      try {
        setIsLoading(true);
        setError(null);
        const data = await updateSkillsApi(token, skills);
        applyProfileResponse(setProfile, setDetails, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update skills';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const runProfileMutation = useCallback(
    async <T,>(action: () => Promise<T & { profile: UserProfile; details: ProfileDetailsData }>) => {
      if (!token) throw new Error('Not authenticated');

      try {
        setIsLoading(true);
        setError(null);
        const data = await action();
        applyProfileResponse(setProfile, setDetails, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Profile update failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const addWorkExperience = useCallback(
    async (payload: WorkExperienceRequest, logoUri?: string | null) => {
      await runProfileMutation(() => addWorkExperienceApi(token!, payload, logoUri));
    },
    [token, runProfileMutation]
  );

  const updateWorkExperience = useCallback(
    async (itemId: string, payload: WorkExperienceRequest, logoUri?: string | null) => {
      await runProfileMutation(() =>
        updateWorkExperienceApi(token!, itemId, payload, logoUri)
      );
    },
    [token, runProfileMutation]
  );

  const deleteWorkExperience = useCallback(
    async (itemId: string) => {
      await runProfileMutation(() => deleteWorkExperienceApi(token!, itemId));
    },
    [token, runProfileMutation]
  );

  const addEducation = useCallback(
    async (payload: EducationRequest, logoUri?: string | null) => {
      await runProfileMutation(() => addEducationApi(token!, payload, logoUri));
    },
    [token, runProfileMutation]
  );

  const updateEducation = useCallback(
    async (itemId: string, payload: EducationRequest, logoUri?: string | null) => {
      await runProfileMutation(() => updateEducationApi(token!, itemId, payload, logoUri));
    },
    [token, runProfileMutation]
  );

  const deleteEducation = useCallback(
    async (itemId: string) => {
      await runProfileMutation(() => deleteEducationApi(token!, itemId));
    },
    [token, runProfileMutation]
  );

  const addLanguage = useCallback(
    async (payload: LanguageRequest, flagImageUri?: string | null) => {
      await runProfileMutation(() => addLanguageApi(token!, payload, flagImageUri));
    },
    [token, runProfileMutation]
  );

  const updateLanguage = useCallback(
    async (itemId: string, payload: LanguageRequest, flagImageUri?: string | null) => {
      await runProfileMutation(() =>
        updateLanguageApi(token!, itemId, payload, flagImageUri)
      );
    },
    [token, runProfileMutation]
  );

  const deleteLanguage = useCallback(
    async (itemId: string) => {
      await runProfileMutation(() => deleteLanguageApi(token!, itemId));
    },
    [token, runProfileMutation]
  );

  const uploadCv = useCallback(
    async (fileUri: string, fileName: string, mimeType: string, isPrimary = false) => {
      await runProfileMutation(() =>
        uploadCvApi(token!, fileUri, fileName, mimeType, isPrimary)
      );
    },
    [token, runProfileMutation]
  );

  const deleteCv = useCallback(
    async (cvId: string) => {
      await runProfileMutation(() => deleteCvApi(token!, cvId));
    },
    [token, runProfileMutation]
  );

  useEffect(() => {
    if (token) {
      fetchProfile().catch(() => {});
    } else {
      clearProfile();
    }
  }, [token, fetchProfile, clearProfile]);

  const value: ProfileContextValue = {
    profile,
    details,
    isLoading,
    error,
    fetchProfile,
    updateBasicProfile,
    updateAvatar,
    updateCompanyLogo,
    updateSummary,
    updateSkills,
    addWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,
    addEducation,
    updateEducation,
    deleteEducation,
    addLanguage,
    updateLanguage,
    deleteLanguage,
    uploadCv,
    deleteCv,
    clearProfile,
    clearError,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
