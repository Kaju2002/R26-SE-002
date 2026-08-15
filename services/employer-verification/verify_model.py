"""Verify trained model and show details"""
import joblib

print("="*70)
print("TRAINED MODEL VERIFICATION")
print("="*70)

try:
    # Load the trained model
    model_data = joblib.load('models/final_realistic_model.pkl')
    model = model_data['model']
    features = model_data['features']
    
    print(f"\n✅ Model Status: LOADED SUCCESSFULLY")
    print(f"\n📊 Model Details:")
    print(f"   Algorithm: {type(model).__name__}")
    print(f"   Total Features: {len(features)}")
    print(f"   Number of Estimators: {model.n_estimators}")
    print(f"   Max Depth: {model.max_depth}")
    print(f"   Class Weight: {model.class_weight}")
    
    print(f"\n🎯 Features Used for Predictions:")
    print(f"   {'#':<3} {'Feature Name':<28} {'Importance':<12} {'%':<6}")
    print(f"   {'-'*55}")
    for i, feat in enumerate(features, 1):
        imp = model.feature_importances_[i-1]
        pct = imp * 100
        print(f"   {i:<3} {feat:<28} {imp:<12.4f} {pct:>5.1f}%")
    
    print(f"\n📈 Top 5 Most Important Features:")
    top_indices = sorted(range(len(model.feature_importances_)), 
                        key=lambda i: model.feature_importances_[i], 
                        reverse=True)[:5]
    for rank, idx in enumerate(top_indices, 1):
        feat = features[idx]
        imp = model.feature_importances_[idx]
        print(f"   {rank}. {feat:<28} {imp:.4f} ({imp*100:.1f}%)")
    
    print(f"\n" + "="*70)
    print("✅ Model is ready for predictions!")
    print("="*70)
    
except FileNotFoundError:
    print("❌ ERROR: Model file not found at 'models/final_realistic_model.pkl'")
except Exception as e:
    print(f"❌ ERROR: {str(e)}")
