import mongoose from "mongoose";

const JOB_MODES = ["On-Site", "Remote", "Hybrid"];
const JOB_TYPES = ["Full-Time", "Part-Time", "Contract", "Internship"];
const JOB_STATUSES = ["active", "closed", "draft"];

const contactSchema = new mongoose.Schema(
  {
    location: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    companyLogo: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    mode: {
      type: String,
      enum: JOB_MODES,
      required: [true, "Work mode is required"],
    },
    type: {
      type: String,
      enum: JOB_TYPES,
      required: [true, "Job type is required"],
    },
    salaryMin: {
      type: Number,
      required: [true, "Minimum salary is required"],
      min: 0,
    },
    salaryMax: {
      type: Number,
      required: [true, "Maximum salary is required"],
      min: 0,
    },
    salaryCurrency: {
      type: String,
      default: "GHS",
      trim: true,
    },
    salaryPeriod: {
      type: String,
      default: "month",
      trim: true,
    },
    description: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    perks: {
      type: [String],
      default: [],
    },
    jobLevel: {
      type: String,
      trim: true,
      default: "",
    },
    education: {
      type: String,
      trim: true,
      default: "",
    },
    experience: {
      type: String,
      trim: true,
      default: "",
    },
    about: {
      type: String,
      trim: true,
      default: "",
    },
    contact: {
      type: contactSchema,
      default: () => ({}),
    },
    postedBy: {
      type: String,
      required: [true, "Posted by user id is required"],
      index: true,
    },
    posterImage: {
      type: String,
      default: null,
      trim: true,
    },
    workspaceId: {
      type: String,
      default: null,
      index: true,
    },
    posterType: {
      type: String,
      enum: ["recruiter", "company"],
      default: "recruiter",
      index: true,
    },
    postedAt: {
      type: Date,
      default: Date.now,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    applicantsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: "active",
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

jobSchema.index({ title: "text", companyName: "text", location: "text" });
jobSchema.index({ postedAt: -1 });
jobSchema.index({ salaryMax: -1 });

jobSchema.pre("validate", function validateSalaryRange() {
  if (this.salaryMax < this.salaryMin) {
    this.invalidate("salaryMax", "Maximum salary must be greater than or equal to minimum salary");
  }
});

const Job = mongoose.model("Job", jobSchema);

export default Job;
export { JOB_MODES, JOB_TYPES, JOB_STATUSES };
