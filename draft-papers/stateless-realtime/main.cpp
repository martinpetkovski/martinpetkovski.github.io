#pragma once
#include <stdio.h>
#include <math.h>

template<typename T, int MaxCapacity>
class MinimalVector
{
private:
    T m_Data[MaxCapacity];
    int m_Size{ 0 };

public:
    void PushBack(const T& element)
    {
        if (m_Size < MaxCapacity)
        {
            m_Data[m_Size++] = element;
        }
    }

    T& operator[](int index) { return m_Data[index]; }
    const T& operator[](int index) const { return m_Data[index]; }
    int Size() const { return m_Size; }
};

class Vector3
{
public:
    double X{ 0.0 }, Y{ 0.0 }, Z{ 0.0 };

    constexpr Vector3() noexcept = default;
    constexpr Vector3(double x, double y, double z) noexcept : X(x), Y(y), Z(z) {}
    explicit constexpr Vector3(double scalar) noexcept : X(scalar), Y(scalar), Z(scalar) {}

    [[nodiscard]] static constexpr Vector3 Zero() noexcept { return { 0.0, 0.0, 0.0 }; }
    [[nodiscard]] static constexpr Vector3 One()  noexcept { return { 1.0, 1.0, 1.0 }; }

    [[nodiscard]] constexpr Vector3 operator+(const Vector3& rhs) const noexcept { return { X + rhs.X, Y + rhs.Y, Z + rhs.Z }; }
    [[nodiscard]] constexpr Vector3 operator-(const Vector3& rhs) const noexcept { return { X - rhs.X, Y - rhs.Y, Z - rhs.Z }; }
    [[nodiscard]] constexpr Vector3 operator*(const Vector3& rhs) const noexcept { return { X * rhs.X, Y * rhs.Y, Z * rhs.Z }; }
    [[nodiscard]] constexpr Vector3 operator/(const Vector3& rhs) const noexcept { return { X / rhs.X, Y / rhs.Y, Z / rhs.Z }; }

    [[nodiscard]] constexpr Vector3 operator*(double scalar) const noexcept { return { X * scalar, Y * scalar, Z * scalar }; }
    [[nodiscard]] constexpr Vector3 operator/(double scalar) const noexcept { return { X / scalar, Y / scalar, Z / scalar }; }

    constexpr Vector3& operator+=(const Vector3& rhs) noexcept { X += rhs.X; Y += rhs.Y; Z += rhs.Z; return *this; }
    constexpr Vector3& operator*=(double scalar)       noexcept { X *= scalar; Y *= scalar; Z *= scalar; return *this; }

    [[nodiscard]] bool Equals(const Vector3& other, double tolerance = 1e-8) const noexcept
    {
        return fabs(X - other.X) <= tolerance &&
            fabs(Y - other.Y) <= tolerance &&
            fabs(Z - other.Z) <= tolerance;
    }

    [[nodiscard]] constexpr double Dot(const Vector3& rhs) const noexcept
    {
        return X * rhs.X + Y * rhs.Y + Z * rhs.Z;
    }

    [[nodiscard]] constexpr Vector3 Cross(const Vector3& rhs) const noexcept
    {
        return { Y * rhs.Z - Z * rhs.Y, Z * rhs.X - X * rhs.Z, X * rhs.Y - Y * rhs.X };
    }

    [[nodiscard]] constexpr double LengthSq() const noexcept { return Dot(*this); }
    [[nodiscard]] double Length() const noexcept { return sqrt(LengthSq()); }

    [[nodiscard]] Vector3 Normalized(double tolerance = 1e-8) const noexcept
    {
        const double lenSq = LengthSq();
        if (lenSq > tolerance)
        {
            return *this * (1.0 / sqrt(lenSq));
        }
        return Zero();
    }

    void Normalize(double tolerance = 1e-8) noexcept { *this = Normalized(tolerance); }

    [[nodiscard]] static constexpr Vector3 Lerp(const Vector3& a, const Vector3& b, double t) noexcept
    {
        return a + (b - a) * t;
    }
};

[[nodiscard]] inline constexpr Vector3 operator*(double scalar, const Vector3& vec) noexcept
{
    return vec * scalar;
}

class Quaternion
{
public:
    double X{ 0.0 }, Y{ 0.0 }, Z{ 0.0 }, W{ 1.0 };

    constexpr Quaternion() noexcept = default;
    constexpr Quaternion(double x, double y, double z, double w) noexcept : X(x), Y(y), Z(z), W(w) {}

    [[nodiscard]] static constexpr Quaternion Identity() noexcept { return { 0.0, 0.0, 0.0, 1.0 }; }

    [[nodiscard]] static Quaternion FromEuler(double pitch, double yaw, double roll) noexcept
    {
        const double hp = pitch * 0.5;
        const double hy = yaw * 0.5;
        const double hr = roll * 0.5;

        const double sp = sin(hp), cp = cos(hp);
        const double sy = sin(hy), cy = cos(hy);
        const double sr = sin(hr), cr = cos(hr);

        return {
            sp * cy * cr - cp * sy * sr,
            cp * sy * cr + sp * cy * sr,
            cp * cy * sr - sp * sy * cr,
            cp * cy * cr + sp * sy * sr
        };
    }

    [[nodiscard]] constexpr Quaternion operator*(const Quaternion& rhs) const noexcept
    {
        return {
            W * rhs.X + X * rhs.W + Y * rhs.Z - Z * rhs.Y,
            W * rhs.Y - X * rhs.Z + Y * rhs.W + Z * rhs.X,
            W * rhs.Z + X * rhs.Y - Y * rhs.X + Z * rhs.W,
            W * rhs.W - X * rhs.X - Y * rhs.Y - Z * rhs.Z
        };
    }

    [[nodiscard]] Vector3 RotateVector(const Vector3& v) const noexcept
    {
        const Vector3 qVec(X, Y, Z);
        const Vector3 t = 2.0 * qVec.Cross(v);
        return v + (W * t) + qVec.Cross(t);
    }

    [[nodiscard]] constexpr Quaternion operator*(double scalar) const noexcept
    {
        return { X * scalar, Y * scalar, Z * scalar, W * scalar };
    }

    [[nodiscard]] constexpr Quaternion operator+(const Quaternion& rhs) const noexcept
    {
        return { X + rhs.X, Y + rhs.Y, Z + rhs.Z, W + rhs.W };
    }

    [[nodiscard]] constexpr double LengthSq() const noexcept { return X * X + Y * Y + Z * Z + W * W; }

    [[nodiscard]] Quaternion Normalized(double tolerance = 1e-8) const noexcept
    {
        const double lenSq = LengthSq();
        if (lenSq > tolerance)
        {
            return *this * (1.0 / sqrt(lenSq));
        }
        return Identity();
    }

    [[nodiscard]] constexpr double Dot(const Quaternion& rhs) const noexcept
    {
        return X * rhs.X + Y * rhs.Y + Z * rhs.Z + W * rhs.W;
    }

    [[nodiscard]] static Quaternion Slerp(Quaternion a, Quaternion b, double t) noexcept
    {
        double dot = a.Dot(b);

        if (dot < 0.0)
        {
            b = b * -1.0;
            dot = -dot;
        }

        const double DOT_THRESHOLD = 0.9995;
        if (dot > DOT_THRESHOLD)
        {
            return (a + (b + (a * -1.0)) * t).Normalized();
        }

        const double theta0 = acos(dot);
        const double theta = theta0 * t;
        const double sinTheta = sin(theta);
        const double sinTheta0 = sin(theta0);

        const double s0 = cos(theta) - dot * sinTheta / sinTheta0;
        const double s1 = sinTheta / sinTheta0;

        return (a * s0) + (b * s1);
    }
};

class Transform
{
public:
    Vector3    Location{ 0.0, 0.0, 0.0 };
    Quaternion Orientation{ 0.0, 0.0, 0.0, 1.0 };
    Vector3    Scale{ 1.0, 1.0, 1.0 };

    constexpr Transform() noexcept = default;
    constexpr Transform(const Vector3& location, const Quaternion& orientation, const Vector3& scale) noexcept
        : Location(location), Orientation(orientation), Scale(scale) {
    }
};

class GameManager;

class Entity
{
public:
    Transform Transform;
    virtual ~Entity() = default;
};

// Extracted to ensure all 3 cameras do the exact same arithmetic workload every frame.
inline void ApplyCameraFollowMath(Transform& camTransform, const Transform& targetTransform, double DeltaTime)
{
    Vector3 offset{ 0.0, 50.0, -100.0 };
    Vector3 desiredPos = targetTransform.Location + offset;

    camTransform.Location = Vector3::Lerp(camTransform.Location, desiredPos, DeltaTime * 5.0);

    Vector3 dir = (targetTransform.Location - camTransform.Location).Normalized();
    Quaternion desiredRot = Quaternion::FromEuler(dir.X, dir.Y, dir.Z);
    camTransform.Orientation = Quaternion::Slerp(camTransform.Orientation, desiredRot, DeltaTime * 5.0);
}

class CameraStateless : public Entity
{
public:
    void Tick(double DeltaTime, const GameManager& GM);
};

class CameraHybrid : public Entity
{
private:
    Entity* CurrentTarget = nullptr;

public:
    void Tick(double DeltaTime, const GameManager& GM);
};

class CameraStateful : public Entity
{
private:
    Entity* CurrentTarget = nullptr;

public:
    void MoveToTarget(Entity* Target)
    {
        CurrentTarget = Target;
    }

    void Tick(double DeltaTime)
    {
        if (CurrentTarget)
        {
            ApplyCameraFollowMath(this->Transform, CurrentTarget->Transform, DeltaTime);
        }
    }
};

class CameraManager
{
public:
    CameraStateless* Stateless = nullptr;
    CameraStateful* Stateful = nullptr;
    CameraHybrid* Hybrid = nullptr;

    void Tick(double DeltaTime, const GameManager& GM)
    {
        if (Stateless) Stateless->Tick(DeltaTime, GM);
        if (Hybrid)    Hybrid->Tick(DeltaTime, GM);
        if (Stateful)  Stateful->Tick(DeltaTime);
    }
};

class GameManager
{
public:
    MinimalVector<Entity*, 16> AllEntities;
    Entity* ActiveEntity = nullptr;
    CameraManager* CamManager = nullptr;

    int CurrentTargetIndex = 0;

    Entity* GetActiveEntity() const
    {
        return ActiveEntity;
    }

    void SetActiveEntity(int Index)
    {
        if (Index >= 0 && Index < AllEntities.Size())
        {
            ActiveEntity = AllEntities[Index];
            CurrentTargetIndex = Index;

            if (CamManager && CamManager->Stateful)
            {
                CamManager->Stateful->MoveToTarget(ActiveEntity);
            }
        }
    }

    void Tick(double DeltaTime)
    {
        if (!ActiveEntity) return;

        ActiveEntity->Transform.Location.Z += 50.0 * DeltaTime;

        if (ActiveEntity->Transform.Location.Z > 200.0)
        {
            ActiveEntity->Transform.Location.Z = 0.0;

            int nextIndex = (CurrentTargetIndex + 1) % AllEntities.Size();
            SetActiveEntity(nextIndex);
        }
    }
};

void CameraStateless::Tick(double DeltaTime, const GameManager& GM)
{
    Entity* FocusTarget = GM.GetActiveEntity();

    if (FocusTarget)
    {
        ApplyCameraFollowMath(this->Transform, FocusTarget->Transform, DeltaTime);
    }
}

void CameraHybrid::Tick(double DeltaTime, const GameManager& GM)
{
    Entity* FocusTarget = GM.GetActiveEntity();

    if (FocusTarget != CurrentTarget)
    {
        CurrentTarget = FocusTarget;
    }

    if (CurrentTarget)
    {
        ApplyCameraFollowMath(this->Transform, CurrentTarget->Transform, DeltaTime);
    }
}


int main()
{
    printf("Initializing Custom Engine Simulation...\n\n");

    GameManager GM;
    CameraManager CamManager;
    GM.CamManager = &CamManager;

    CameraStateless CamStateless;
    CameraHybrid CamHybrid;
    CameraStateful CamStateful;

    CamManager.Stateless = &CamStateless;
    CamManager.Hybrid = &CamHybrid;
    CamManager.Stateful = &CamStateful;

    Entity Player1;
    Player1.Transform.Location = Vector3(0.0, 0.0, 0.0);

    Entity Player2;
    Player2.Transform.Location = Vector3(100.0, 0.0, 50.0);

    GM.AllEntities.PushBack(&Player1);
    GM.AllEntities.PushBack(&Player2);

    GM.SetActiveEntity(0);

    const double DeltaTime = 0.0166667;
    const int TotalFrames = 600;

    for (int Frame = 1; Frame <= TotalFrames; ++Frame)
    {
        GM.Tick(DeltaTime);
        CamManager.Tick(DeltaTime, GM);
    }

    printf("Simulation complete. Final Camera Transforms:\n");

    auto printTransform = [](const char* name, const Transform& t) {
        printf("--- %s ---\n", name);
        printf("Location: X=%.4f Y=%.4f Z=%.4f\n", t.Location.X, t.Location.Y, t.Location.Z);
        printf("Rotation: X=%.4f Y=%.4f Z=%.4f W=%.4f\n\n", t.Orientation.X, t.Orientation.Y, t.Orientation.Z, t.Orientation.W);
        };

    printTransform("Camera Stateless", CamStateless.Transform);
    printTransform("Camera Hybrid", CamHybrid.Transform);
    printTransform("Camera Stateful", CamStateful.Transform);

    return 0;
}