# Code Standard

## Naming
(If you absolutely must) Global variables have the prefix "g" .

	float gGlobalFloat;

Local variables and function arguments use camelCase.

	void SomeFunction(float argumentName)
	{
		float localVariable = 0.0f;
	}

Member variables should have the prefix "m".

	class Vehicle
	{
		private:
			float mMemberVariable = 0.0f;
			float mSomethingElse = 0.0f;
	};

Functions, enums, classes and structs use PascalCase.

	float FunctionName()
	
	enum class VehicleType
	class VehicleCar
	struct VehicleParameters

Macros and labels are UPPERCASE_UNDERSCORE.

	#define USE_POINTER
	SOME_LABEL:

Enums should be scoped with enum class, enum members are named using PascalCase, each one in a new row.

	enum class Elements
	{
		Air,
		Water,
		Earth,
		Sand,
		FifthElement
	}

Unscoped enum members should have the "k" prefix.

	enum Elements
	{
		kAir,
		kWater,
		kEarth,
		kSand,
		kFifthElement
	}

## Indentation

Indent using tabs. Tabs are 4 characters.

Rationale: It's enough to be clear and is the default in most good IDEs i.e. Visual Studio.

If you are indenting more than 5 times, you should consider splitting the function.

Don't put multiple statements on a single line unless you have something to hide:

	if (condition) DontDoThis();
	DoSomethingEverytime();

Don't put multiple assignments on a single line.

	dontDoThis = 6; please=7;

## Line length

The preffered column limit is 120 characters.

Rationale: A vertically oriented monitor (1080p) on 100% document zoom will fit all lines of 120 characters comfortably. 

If you have to split the line because you've reached the character limit, consider simplifying the expression. An exception are lengthy strings which should be split in multiple lines.

## Braces

All curly braces should be in their own line. 

	if (condition)
	{
		DoSomething();
	}

Do not unnecessarily use braces where a single statement will do.

	if (condition)
		action();

and

	if (condition)
		do_this();
	else
		do_that();

This does not apply if only one branch of a conditional statement is a single statement; in the latter case use braces in both branches:

	if (condition) 
	{
			do_this();
			do_that();
	} 
	else 
	{
			otherwise();
	}

## Spaces

Use a space after these keywords:

	if, switch, case, for, do, while

but not with sizeof, typeof

	s = sizeof(struct file);

Do not add spaces around (inside) parenthesized expressions. This example is **bad**:

	s = sizeof( struct file );

When declaring pointer data or a function that returns a pointer type, the preferred use of * is adjacent to the type name or function type and not adjacent to the variable or function name. Examples:

	 char* stringOfText;
	 void* SomeFunction(const float* someArg);

Rationale: The * is a modifier to the type, not to the name.

Use one space around (on each side of) most binary and ternary operators, such as any of these:

	=  +  -  <  >  *  /  %  |  &  ^  <=  >=  ==  !=  ?  :

but no space after (or before) unary operators:

	&  *  +  -  ++ --  ~  !  sizeof  typeof 

## Macros

Avoid using them.  Don't define constants using macros, instead use global constant variables. Use inline functions instead of macro functions where possible. 

With that said, here are some exceptions:
- When used in if-defs.
- When using preprocessor operators is a must.
- When simplifying super-complex template expressions (you should consider changing the template definitions to be simpler).

Macros that resemble functions are heresy.

	#define FOO(x)               \
	({                                      \
			typeof(x) ret;            \
			ret = calc_ret(x);       \
			(ret);                          \
	}) 
	// WHY?

## Const-correctness

All functions must be const-correct. Member variables must be const-correct Local variables should be const-correct, but don't have to be.

## Functions

Functions should be short and sweet, and do just one thing. They should fit on one screenful of text which is 50 lines.

Rationale: 50 lines can fit comfortably on a horizontally oriented 1080p monitor with 100% zoom.

The maximum length of a function is inversely proportional to the complexity and indentation level of that function. So, if you have a conceptually simple function that is just one long if-else statement, where you have to do lots of small things for a lot of different cases, it's OK to have a longer function.

Another measure of the function is the number of local variables. They shouldn't exceed 5-10, or you're doing something wrong.

Use helper functions with descriptive names.

## Returning from functions

Single-exit functions are preferred. Use early-outs only if they are located immediately after the beginning of the function.

Example:

	int SomeFunction(Vehicle* someCar)
	{
		if(!someCar)
			return 0;
		
		int retVal = 0;

		if(condition)
		{
			doSomethingElse();
			retVal = 1;
		}
		
		return retVal; 
	}

## Lambda functions

Forbidden. Use pointers to functions instead.

## Inline

A reasonable rule of thumb is to not put inline at functions that have more than 3 lines of code in them. An exception to this rule are the cases where a parameter is known to be a compiletime constant, and as a result of this constantness you know the compiler will be able to optimize most of your function away at compile time.

## goto

Allowed, depending on the use case.

Example when breaking out of a nested for loop:

	for(size_t i = 0; i < 10; i++)
	{
		for(size_t j = 0; j < 10; j++)
		{
			if(condition)
			{
				goto SOME_LABEL;
			}
		}
	}
	
	SOME_LABEL:
	doSomething();

## Commenting

Write comments in header files. Do not try to explain **how** a function works in the comments. Instead, write the purpose and intention of the function and what's the expected result. 

The code in source files should be self-explanatory. 

	/* The preferred comment style looks like this.
	 *
	 * Description:  A column of asterisks on the left side,
	 * with beginning and ending almost-blank lines.
	 */


